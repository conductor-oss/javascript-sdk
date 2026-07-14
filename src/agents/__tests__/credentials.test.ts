import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  getCredential,
  setCredentialContext,
  clearCredentialContext,
  runWithCredentialContext,
} from "../credentials.js";
import { CredentialNotFoundError, CredentialAuthError } from "../errors.js";

// ── getCredential (spec R6 — reads from delivered runtimeMetadata, no fetch) ──

describe("getCredential", () => {
  beforeEach(() => {
    clearCredentialContext();
  });

  afterEach(() => {
    clearCredentialContext();
  });

  it("throws when no context is set", async () => {
    await expect(getCredential("MY_CRED")).rejects.toThrow(CredentialAuthError);
    await expect(getCredential("MY_CRED")).rejects.toThrow("No credential context available");
  });

  it("resolves a credential already delivered on the context (no network call)", async () => {
    setCredentialContext({ MY_CRED: "secret-value" });
    const value = await getCredential("MY_CRED");
    expect(value).toBe("secret-value");
  });

  it("throws CredentialNotFoundError when the name isn't in the delivered context", async () => {
    setCredentialContext({ OTHER_CRED: "value" });
    await expect(getCredential("MISSING")).rejects.toThrow(CredentialNotFoundError);
  });
});

// ── runWithCredentialContext ─────────────────────────────

describe("runWithCredentialContext", () => {
  afterEach(() => {
    clearCredentialContext();
  });

  it("scopes delivered credentials to the call and clears them afterward", async () => {
    const value = await runWithCredentialContext({ MY_CRED: "scoped-value" }, () =>
      getCredential("MY_CRED"),
    );
    expect(value).toBe("scoped-value");
    await expect(getCredential("MY_CRED")).rejects.toThrow("No credential context available");
  });

  it.each([1, 2, 3])(
    "isolates concurrent executions (run %i) — each call sees only its own delivered values",
    async () => {
      // Reproduce the worker race that breaks test_suite2_tool_calling:
      //   1. Worker A enters context, starts handler.
      //   2. Worker B enters context, finishes, exits.
      //   3. Worker A's handler later calls getCredential — without per-async
      //      isolation, B's exit nulled A's context and getCredential throws.
      // Test re-runs (1-3) to surface scheduling-dependent regressions.
      async function workerHandler(taskId: string, delayMs: number) {
        return runWithCredentialContext({ MY_KEY: `${taskId}:resolved` }, async () => {
          await new Promise((r) => setTimeout(r, delayMs));
          return getCredential("MY_KEY");
        });
      }

      const results = await Promise.all([
        workerHandler("tok-A", 30),
        workerHandler("tok-B", 5),
        workerHandler("tok-C", 20),
        workerHandler("tok-D", 10),
        workerHandler("tok-E", 15),
      ]);

      expect(results).toEqual([
        "tok-A:resolved",
        "tok-B:resolved",
        "tok-C:resolved",
        "tok-D:resolved",
        "tok-E:resolved",
      ]);
    },
  );
});

// ── R12 deletion (spec test T17 shape) ───────────────────

describe("R12 deletions", () => {
  it("no longer exports extractExecutionToken or resolveCredentials", async () => {
    const mod = await import("../credentials.js");
    expect((mod as Record<string, unknown>).extractExecutionToken).toBeUndefined();
    expect((mod as Record<string, unknown>).resolveCredentials).toBeUndefined();
  });
});
