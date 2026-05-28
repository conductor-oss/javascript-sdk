/**
 * Poll an async function until a predicate is satisfied or timeout is reached.
 * Swallows errors from `fn` so that transient failures (502, empty response, etc.)
 * don't abort the poll loop.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  {
    maxWaitMs = 60000,
    intervalMs = 1000,
    label = "pollUntil",
  }: { maxWaitMs?: number; intervalMs?: number; label?: string } = {}
): Promise<T> {
  const start = Date.now();
  let lastResult: T | undefined;
  let lastError: unknown;

  while (Date.now() - start < maxWaitMs) {
    try {
      lastResult = await fn();
      if (predicate(lastResult)) return lastResult;
      lastError = undefined;
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  if (lastError) {
    throw new Error(
      `${label}: condition not met within ${maxWaitMs}ms (last error: ${lastError})`
    );
  }
  throw new Error(`${label}: condition not met within ${maxWaitMs}ms`);
}
