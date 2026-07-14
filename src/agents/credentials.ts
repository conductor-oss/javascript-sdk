import { AsyncLocalStorage } from "node:async_hooks";

import { CredentialNotFoundError, CredentialAuthError } from "./errors.js";

// ── Per-async-call credential context ────────────────────

interface CredentialContext {
  /** Name -> resolved value, delivered on `Task.runtimeMetadata` at poll time (spec R6). */
  credentials: Record<string, string>;
}

// AsyncLocalStorage scopes context per async-call chain so concurrent worker
// handlers each see their own credentials instead of clobbering a shared global.
const _credentialStore = new AsyncLocalStorage<CredentialContext>();

// Fallback used by setCredentialContext() — kept for callers that can't run
// inside runWithCredentialContext(). Reads always prefer the ALS store.
let _fallbackContext: CredentialContext | null = null;

function activeContext(): CredentialContext | null {
  return _credentialStore.getStore() ?? _fallbackContext;
}

/**
 * Run `fn` with the given resolved credentials active in AsyncLocalStorage.
 * Concurrent calls each see their own context — sibling cleanups can't clobber it.
 *
 * @param credentials Name -> resolved value, as delivered on the polled task's
 *   `runtimeMetadata` (spec R6) — never fetched here.
 */
export function runWithCredentialContext<T>(
  credentials: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  return _credentialStore.run({ credentials }, fn);
}

/**
 * Set a fallback credential context for getCredential().
 *
 * Prefer {@link runWithCredentialContext} — it scopes context per async call
 * and is safe under concurrent workers. setCredentialContext writes to a
 * shared module-level slot and is only consulted when no ALS context is
 * active; sibling clears can race with concurrent reads.
 */
export function setCredentialContext(credentials: Record<string, string>): void {
  _fallbackContext = { credentials };
}

/**
 * Clear the fallback credential context. Does not affect ALS-scoped contexts.
 */
export function clearCredentialContext(): void {
  _fallbackContext = null;
}

// ── getCredential ────────────────────────────────────────

/**
 * Resolve a single credential by name from the active context.
 *
 * Uses the active credential context (per-async via {@link runWithCredentialContext},
 * falling back to {@link setCredentialContext} for legacy callers). The value
 * was already delivered by the server on the task's `runtimeMetadata` (spec
 * R6) — this never makes a network call. Throws if no context is set (i.e.,
 * not called during worker execution) or if `name` wasn't resolved.
 */
export async function getCredential(name: string): Promise<string> {
  const ctx = activeContext();
  if (!ctx) {
    throw new CredentialAuthError(
      "No credential context available. getCredential() must be called during worker execution.",
    );
  }

  const value = ctx.credentials[name];
  if (value === undefined) {
    throw new CredentialNotFoundError(name);
  }

  return value;
}

// ── Concurrency-safe injection (Tier 2 fallback) ───────────────────────────────
//
// See docs/design/secret-injection-contract.md.
//
// A single module-scoped Promise chain serializes mutate-invoke-restore across
// all callers in this process. Node is single-threaded, but `process.env` is
// still shared across all in-flight async operations — two concurrent
// invocations would interleave across `await` boundaries and clobber each
// other's env if there were no lock.

let _envInjectionMutex: Promise<void> = Promise.resolve();

/**
 * Run `invoke()` with `secrets` injected into `process.env` for the duration
 * of the call. Mutation, invocation, and restoration happen atomically with
 * respect to any other call to this function in this process — concurrent
 * callers serialize.
 *
 * Tier-1 (explicit-key) integrations should NOT use this — they should pass
 * resolved values directly to model client constructors, bypassing `process.env`
 * entirely.
 *
 * @param secrets - name → plaintext (non-string values silently skipped)
 * @param invoke - async function that runs the framework
 * @returns Whatever `invoke()` resolves with.
 */
export async function injectSecretsForInvocation<T>(
  credentials: Record<string, string>,
  invoke: () => Promise<T>,
): Promise<T> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(credentials)) {
    if (typeof v === "string") clean[k] = v;
  }
  if (Object.keys(clean).length === 0) {
    return invoke();
  }

  // Enqueue this call after the current tail of the chain.
  const previous = _envInjectionMutex;
  let resolveSlot!: () => void;
  _envInjectionMutex = new Promise<void>((res) => {
    resolveSlot = res;
  });

  try {
    await previous;
    const restorers: (() => void)[] = [];
    for (const [k, v] of Object.entries(clean)) {
      const prev = process.env[k];
      process.env[k] = v;
      restorers.push(() => {
        if (prev === undefined) Reflect.deleteProperty(process.env, k);
        else process.env[k] = prev;
      });
    }
    try {
      return await invoke();
    } finally {
      for (const r of restorers) r();
    }
  } finally {
    resolveSlot();
  }
}
