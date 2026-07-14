import {
  handleAuth,
  resolveFetchFn,
  resolveOrkesConfig,
  wrapFetchWithRetry,
} from "./helpers";
import type { OrkesApiConfig } from "../types";
import { createClient } from "../../open-api/generated/client";
import { addResourcesBackwardCompatibility } from "./helpers/addResourcesBackwardCompatibility";
import { createMetricsInterceptors } from "./helpers/metricsInterceptors";

/**
 * Creates a Conductor client with authentication and configuration
 *
 * @param config (optional) OrkesApiConfig with keyId and keySecret
 * @param customFetch (optional) custom fetch function
 * @returns Client
 */
export const createConductorClient = async (
  config?: OrkesApiConfig,
  customFetch?: typeof fetch
) => {
  const {
    serverUrl,
    keyId,
    keySecret,
    maxHttp2Connections,
    refreshTokenInterval,
    logger,
    requestTimeoutMs,
    connectTimeoutMs,
    tlsCertPath,
    tlsKeyPath,
    tlsCaPath,
    proxyUrl,
    tlsInsecure,
    disableHttp2,
    retryServerErrors,
  } = resolveOrkesConfig(config);

  if (!serverUrl) throw new Error("Conductor server URL is not set");

  const baseFetchFn = await resolveFetchFn(customFetch, {
    maxHttpConnections: maxHttp2Connections,
    connectTimeoutMs,
    tlsCertPath,
    tlsKeyPath,
    tlsCaPath,
    proxyUrl,
    tlsInsecure,
    disableHttp2,
  });

  // Start with retry + timeout on fetch (no auth failure callback yet)
  const openApiClient = createClient({
    baseUrl: serverUrl,
    fetch: wrapFetchWithRetry(baseFetchFn, { requestTimeoutMs, retryServerErrors }),
    throwOnError: true,
  });

  const { onRequest } = createMetricsInterceptors();
  openApiClient.interceptors.request.use(onRequest);

  let authResult: Awaited<ReturnType<typeof handleAuth>> | undefined;
  if (keyId && keySecret) {
    authResult = await handleAuth(
      openApiClient,
      keyId,
      keySecret,
      refreshTokenInterval,
      logger
    );
  }

  // Upgrade fetch with auth failure callback now that auth is set up.
  // This replaces the initial wrapper, adding onAuthFailure for 401/403 retry.
  if (authResult) {
    openApiClient.setConfig({
      fetch: wrapFetchWithRetry(baseFetchFn, {
        onAuthFailure: authResult.refreshToken,
        requestTimeoutMs,
        retryServerErrors,
      }),
    });
  }

  // Legacy compatibility: Adds resource-based API methods for backward compatibility.
  // The modern API is available directly on openApiClient, but legacy methods are maintained.
  const client = addResourcesBackwardCompatibility(openApiClient);

  return Object.assign(client, {
    /**
     * The same `X-Authorization` header the standard call path attaches,
     * exposed for transports that can't go through `client.request` (SSE).
     * Borrows the client's TTL-aware token — mints/caches nothing of its own.
     */
    getAuthenticationHeaders: async (): Promise<Record<string, string> | null> => {
      const token = await authResult?.getToken();
      return token ? { "X-Authorization": token } : null;
    },
    /**
     * Stops this client's background token-refresh interval. `handleAuth`'s
     * handle was previously captured locally and dropped, leaking the
     * interval for the life of the process.
     */
    stopBackgroundRefresh: (): void => {
      authResult?.stopBackgroundRefresh();
    },
  });
};
