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

/**
 * Check if a 401/403 response indicates a token problem (expired or invalid)
 * vs a permission error that should NOT trigger a token refresh.
 *
 * The Conductor server returns error codes in the JSON body:
 *   { "error": "EXPIRED_TOKEN", "message": "..." }  -> token problem, refresh
 *   { "error": "INVALID_TOKEN", "message": "..." }  -> token problem, refresh
 *   { "error": "...", "message": "..." }             -> permission denied, don't refresh
 *
 * Matches the Python SDK behavior: only refresh+retry for EXPIRED_TOKEN or INVALID_TOKEN.
 */
const TOKEN_ERROR_CODES = new Set(["EXPIRED_TOKEN", "INVALID_TOKEN"]);

const isTokenError = async (response: Response): Promise<boolean> => {
  try {
    // Clone to avoid consuming the body for downstream callers
    const body = await response.clone().json();
    const errorCode =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "";
    return TOKEN_ERROR_CODES.has(errorCode);
  } catch {
    // If the body isn't JSON or can't be parsed, treat 401 as a likely token error
    // (safe default: attempt one refresh). 403 without a parseable body is more
    // likely a permission error, so don't retry.
    return response.status === 401;
  }
};

/** Add ±10% jitter to prevent thundering herd on retries */
const withJitter = (delayMs: number): number => {
  const jitter = delayMs * 0.1 * (2 * Math.random() - 1);
  return Math.max(0, Math.round(delayMs + jitter));
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

  // Request bodies are single-use ReadableStreams. Clone Request inputs
  // before each attempt so retries get a fresh body stream.
  // this prevents errors like: "Failed to register workflow: Response body object should not be disturbed or locked"
  const freshInput = (): Input =>
    input instanceof Request ? input.clone() : input;

  let lastError: unknown;

  // Transport retry loop
  for (let transportAttempt = 0; transportAttempt <= maxTransportRetries; transportAttempt++) {
    let response: Response;
    try {
      response = await fetchFn(freshInput(), effectiveInit);
    } catch (error) {
      // Timeout/abort errors should NOT be retried
      if (isTimeoutError(error)) {
        throw error;
      }
      // Transport error - retry with linear backoff
      lastError = error;
      if (transportAttempt < maxTransportRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, withJitter(initialRetryDelay * (transportAttempt + 1)))
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
        await new Promise((resolve) => setTimeout(resolve, withJitter(delay)));
        rateLimitResponse = await fetchFn(freshInput(), effectiveInit);
        if (rateLimitResponse.status !== 429) {
          return rateLimitResponse;
        }
        delay *= 2;
      }
      return rateLimitResponse;
    }

    // Auth failure retry (401/403) - only refresh+retry when the error is a token
    // problem (EXPIRED_TOKEN or INVALID_TOKEN). Permission errors should propagate
    // immediately without wasting a token refresh + retry round-trip.
    if (
      (response.status === 401 || response.status === 403) &&
      onAuthFailure &&
      (await isTokenError(response))
    ) {
      const newToken = await onAuthFailure();
      if (newToken) {
        // Clone request with updated auth header
        const retryInit = {
          ...effectiveInit,
          headers: new Headers(effectiveInit?.headers),
        };
        retryInit.headers.set("X-Authorization", newToken);
        return await fetchFn(freshInput(), retryInit);
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
