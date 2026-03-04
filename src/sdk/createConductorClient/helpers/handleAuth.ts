import type { Client } from "../../../open-api/generated/client/types.gen";
import { TokenResource } from "../../../open-api/generated";
import { ConductorSdkError } from "../../helpers/errors";
import type { ConductorLogger } from "../../helpers/logger";
import {
  TOKEN_TTL_MS,
  MAX_AUTH_FAILURES,
  MAX_AUTH_BACKOFF_MS,
  MAX_INITIAL_TOKEN_RETRIES,
} from "../constants";

export interface HandleAuthResult {
  refreshToken: () => Promise<string | undefined>;
  stopBackgroundRefresh: () => void;
}

export const handleAuth = async (
  openApiClient: Client,
  keyId: string,
  keySecret: string,
  refreshTokenInterval: number,
  logger?: ConductorLogger
): Promise<HandleAuthResult | undefined> => {
  let token: string | undefined;
  let tokenObtainedAt = 0;
  let isOss = false;
  let consecutiveFailures = 0;
  let lastRefreshFailureAt = 0;

  // Mutex: if a refresh is already in flight, callers await the same promise
  // instead of firing a second concurrent request.
  let refreshInFlight: Promise<string | undefined> | null = null;

  const getNewToken = async (): Promise<string | undefined> => {
    const { data, error, response } = await TokenResource.generateToken({
      body: { keyId, keySecret },
      client: openApiClient,
      throwOnError: false,
    });

    if (response?.status === 404) {
      isOss = true;
      logger?.info("Conductor OSS detected (no /token endpoint), proceeding without auth");
      return undefined;
    }

    if (error || !data?.token) {
      // Parse auth error code from response body (Python SDK checks EXPIRED_TOKEN, INVALID_TOKEN)
      const errorCode =
        error && typeof error === "object" && "error" in error
          ? String((error as { error: unknown }).error)
          : undefined;
      if (errorCode) {
        logger?.debug(`Auth error code from server: ${errorCode}`);
      }

      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unknown error";
      throw new ConductorSdkError(
        `Failed to generate authorization token: ${message}`,
        error instanceof Error ? error : undefined
      );
    }

    token = data.token as string;
    tokenObtainedAt = Date.now();
    return token;
  };

  /**
   * Guarded version of getNewToken that prevents concurrent calls.
   * If a refresh is already in flight, callers coalesce onto the same promise.
   */
  const getNewTokenGuarded = async (): Promise<string | undefined> => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = getNewToken().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  };

  /**
   * Calculate the exponential backoff delay for the current failure count.
   * Returns 2^(failures-1) * 1000ms, capped at MAX_AUTH_BACKOFF_MS.
   */
  const getBackoffMs = (failures: number): number => {
    return Math.min(Math.pow(2, failures - 1) * 1000, MAX_AUTH_BACKOFF_MS);
  };

  /**
   * Check if we should skip a refresh attempt due to backoff.
   * Returns true if not enough time has passed since the last failure.
   */
  const shouldBackoff = (): boolean => {
    if (consecutiveFailures === 0 || lastRefreshFailureAt === 0) return false;
    const backoffMs = getBackoffMs(consecutiveFailures);
    return Date.now() - lastRefreshFailureAt < backoffMs;
  };

  const refreshToken = async (): Promise<string | undefined> => {
    if (isOss) return undefined;
    if (shouldBackoff()) return token; // respect backoff, fall back to current token
    try {
      const newToken = await getNewTokenGuarded();
      consecutiveFailures = 0;
      return newToken;
    } catch {
      consecutiveFailures++;
      lastRefreshFailureAt = Date.now();
      return token; // fall back to current token
    }
  };

  // Initial auth with retry (no mutex needed -- nothing else is running yet)
  for (let attempt = 1; attempt <= MAX_INITIAL_TOKEN_RETRIES; attempt++) {
    try {
      await getNewToken();
      break;
    } catch (e) {
      if (isOss) {
        return undefined;
      }
      if (attempt < MAX_INITIAL_TOKEN_RETRIES) {
        const backoffMs = getBackoffMs(attempt);
        logger?.warn?.(
          `Initial token request failed (attempt ${attempt}/${MAX_INITIAL_TOKEN_RETRIES}), ` +
            `retrying in ${backoffMs}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } else {
        logger?.error("Initial token generation failed after all retries", e);
        throw e;
      }
    }
  }

  if (isOss) {
    return undefined;
  }

  // Set auth as a callback so token is checked before each request
  openApiClient.setConfig({
    auth: async () => {
      if (isOss) return undefined;
      // If token is close to expiry, refresh inline before the request
      if (Date.now() - tokenObtainedAt >= TOKEN_TTL_MS) {
        if (!shouldBackoff()) {
          try {
            await getNewTokenGuarded();
            consecutiveFailures = 0;
          } catch {
            consecutiveFailures++;
            lastRefreshFailureAt = Date.now();
            logger?.warn?.("Pre-request token refresh failed, using existing token");
          }
        }
      }
      return token;
    },
  });

  // Background refresh -- use the shorter of the configured interval and 80% of token TTL
  // to ensure the token is refreshed before it expires
  const effectiveRefreshInterval = Math.min(
    refreshTokenInterval,
    Math.floor(TOKEN_TTL_MS * 0.8)
  );

  let refreshIntervalHandle: ReturnType<typeof setInterval> | undefined;

  if (effectiveRefreshInterval > 0) {
    refreshIntervalHandle = setInterval(async () => {
      if (isOss) return;

      // Skip this tick if we're in backoff
      if (shouldBackoff()) {
        return;
      }

      try {
        await getNewTokenGuarded();
        consecutiveFailures = 0;
      } catch {
        consecutiveFailures++;
        lastRefreshFailureAt = Date.now();
        if (consecutiveFailures >= MAX_AUTH_FAILURES) {
          logger?.error(
            `Token refresh has failed ${consecutiveFailures} consecutive times. ` +
              `Next retry backed off ${getBackoffMs(consecutiveFailures)}ms. ` +
              "Pre-request TTL check will attempt refresh before next API call."
          );
        } else {
          logger?.warn?.(
            `Token refresh failed (attempt ${consecutiveFailures}/${MAX_AUTH_FAILURES}), ` +
              `backing off ${getBackoffMs(consecutiveFailures)}ms`
          );
        }
      }
    }, effectiveRefreshInterval);
  }

  const stopBackgroundRefresh = () => {
    if (refreshIntervalHandle !== undefined) {
      clearInterval(refreshIntervalHandle);
      refreshIntervalHandle = undefined;
    }
  };

  return { refreshToken, stopBackgroundRefresh };
};
