/**
 * Jest replacement for vitest's `vi.stubGlobal`.
 *
 * Upstream never unstubs (per-file worker isolation contains the leakage, and
 * jest isolates the same way), so this is a plain assignment with the original
 * kept around for tests that want to restore explicitly.
 */
const originals = new Map<string, unknown>();

export function stubGlobal(key: string, value: unknown): void {
  const g = globalThis as Record<string, unknown>;
  if (!originals.has(key)) {
    originals.set(key, g[key]);
  }
  g[key] = value;
}

export function unstubAllGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  for (const [key, value] of originals) {
    g[key] = value;
  }
  originals.clear();
}
