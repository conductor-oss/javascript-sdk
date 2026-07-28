/**
 * Deprecated `AGENTSPAN_*` environment variable support.
 *
 * The agent layer's config surface was renamed `AGENTSPAN_*` ->
 * `CONDUCTOR_AGENT_*` when Agentspan became Conductor. The old names still
 * resolve so existing deployments keep working, but each one warns once per
 * process the first time it actually supplies a value.
 *
 * Deliberately standalone rather than sharing a helper with `src/sdk`: the
 * agent layer's only permitted coupling to the workflow layer is in
 * `agent-client.ts` and `worker.ts` (see AGENTS.md).
 */

const warned = new Set<string>();

/**
 * Read a renamed environment variable, preferring the canonical name.
 *
 * Warns once per legacy name, and only when the legacy name is the one that
 * actually supplied the value — callers already on `CONDUCTOR_AGENT_*` never
 * see output, and a value of `""` is treated as unset to match the parsers.
 */
export function readRenamedEnv(canonical: string, legacy: string): string | undefined {
  const env = process.env;
  const current = env[canonical];
  if (current !== undefined && current !== "") return current;

  const legacyValue = env[legacy];
  if (legacyValue === undefined || legacyValue === "") return undefined;

  if (!warned.has(legacy)) {
    warned.add(legacy);
    console.warn(
      `[conductor] ${legacy} is deprecated and will be removed in a future release. Use ${canonical} instead.`,
    );
  }
  return legacyValue;
}

/** Test-only: clear the warn-once state so each case starts clean. */
export function resetRenamedEnvWarnings(): void {
  warned.clear();
}
