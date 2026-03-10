import {
  handleAuth,
  resolveFetchFn,
  resolveOrkesConfig,
  wrapFetchWithRetry,
} from "./helpers";
import type { OrkesApiConfig } from "../types";
import { createClient } from "../../open-api/generated/client";
import { addResourcesBackwardCompatibility } from "./helpers/addResourcesBackwardCompatibility";

let hasLoggedServerUrl = false;

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
  } = resolveOrkesConfig(config);

  if (!serverUrl) throw new Error("Conductor server URL is not set");

  if (!hasLoggedServerUrl) {
    hasLoggedServerUrl = true;
    console.log("[Conductor SDK] serverUrl:", serverUrl);
  }

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
    fetch: wrapFetchWithRetry(baseFetchFn, { requestTimeoutMs }),
    throwOnError: true,
  });

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
      }),
    });
  }

  // Legacy compatibility: Adds resource-based API methods for backward compatibility.
  // The modern API is available directly on openApiClient, but legacy methods are maintained.
  return addResourcesBackwardCompatibility(openApiClient);
};
