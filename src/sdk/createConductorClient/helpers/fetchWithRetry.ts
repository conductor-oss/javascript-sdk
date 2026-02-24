type Input = Parameters<typeof fetch>[0];
type Init = Parameters<typeof fetch>[1];

export interface RetryFetchOptions {
  onAuthFailure?: () => Promise<string | undefined>;
  requestTimeoutMs?: number;
  maxRateLimitRetries?: number; // default 5
  maxTransportRetries?: number; // default 3
  initialRetryDelay?: number; // default 1000ms
}

const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "TimeoutError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
};

// AbortSignal.timeout and AbortSignal.any are available in Node 18+ and Node 20+ respectively,
// but may not be in the TypeScript DOM lib types.
const AbortSignalWithExtensions = AbortSignal as typeof AbortSignal & {
  timeout?: (ms: number) => AbortSignal;
  any?: (signals: AbortSignal[]) => AbortSignal;
};

export const applyTimeout = (
  init: Init | undefined,
  timeoutMs: number
): Init => {
  const existingSignal = init?.signal;

  if (!AbortSignalWithExtensions.timeout) {
    // Runtime doesn't support AbortSignal.timeout, skip timeout
    return init ?? {};
  }

  const timeoutSignal = AbortSignalWithExtensions.timeout(timeoutMs);

  if (!existingSignal) {
    return { ...init, signal: timeoutSignal };
  }

  // Combine existing signal with timeout signal
  if (typeof AbortSignalWithExtensions.any === "function") {
    return { ...init, signal: AbortSignalWithExtensions.any([existingSignal, timeoutSignal]) };
  }

  // Fallback for Node 18 (no AbortSignal.any)
  const controller = new AbortController();
  const onAbort = () => controller.abort(existingSignal.reason ?? timeoutSignal.reason);

  if (existingSignal.aborted || timeoutSignal.aborted) {
    controller.abort(existingSignal.reason ?? timeoutSignal.reason);
  } else {
    existingSignal.addEventListener("abort", onAbort, { once: true });
    timeoutSignal.addEventListener("abort", onAbort, { once: true });
  }

  return { ...init, signal: controller.signal };
};

export const retryFetch = async (
  input: Input,
  init: Init,
  fetchFn: typeof fetch,
  options: RetryFetchOptions = {}
): Promise<Response> => {
  const {
    onAuthFailure,
    requestTimeoutMs,
    maxRateLimitRetries = 5,
    maxTransportRetries = 3,
    initialRetryDelay = 1000,
  } = options;

  const effectiveInit = requestTimeoutMs
    ? applyTimeout(init, requestTimeoutMs)
    : init;

  let lastError: unknown;

  // Transport retry loop
  for (let transportAttempt = 0; transportAttempt <= maxTransportRetries; transportAttempt++) {
    let response: Response;
    try {
      response = await fetchFn(input, effectiveInit);
    } catch (error) {
      // Timeout/abort errors should NOT be retried
      if (isTimeoutError(error)) {
        throw error;
      }
      // Transport error - retry with linear backoff
      lastError = error;
      if (transportAttempt < maxTransportRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, initialRetryDelay * (transportAttempt + 1))
        );
        continue;
      }
      throw error;
    }

    // Rate limit retry (429)
    if (response.status === 429) {
      let rateLimitResponse = response;
      let delay = initialRetryDelay;
      for (let rlAttempt = 0; rlAttempt < maxRateLimitRetries; rlAttempt++) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        rateLimitResponse = await fetchFn(input, effectiveInit);
        if (rateLimitResponse.status !== 429) {
          return rateLimitResponse;
        }
        delay *= 2;
      }
      return rateLimitResponse;
    }

    // Auth failure retry (401/403) - retry once with refreshed token
    if ((response.status === 401 || response.status === 403) && onAuthFailure) {
      const newToken = await onAuthFailure();
      if (newToken) {
        // Clone request with updated auth header
        const retryInit = {
          ...effectiveInit,
          headers: new Headers(effectiveInit?.headers),
        };
        retryInit.headers.set("X-Authorization", newToken);
        return await fetchFn(input, retryInit);
      }
    }

    return response;
  }

  // Should not reach here, but just in case
  throw lastError ?? new Error("Fetch retry exhausted");
};

export const wrapFetchWithRetry = (
  fetchFn: typeof fetch,
  options?: RetryFetchOptions
): typeof fetch => {
  return (input: Input, init?: Init): Promise<Response> => {
    return retryFetch(input, init, fetchFn, options);
  };
};
