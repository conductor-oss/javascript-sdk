import {
  handleAuth,
  resolveFetchFn,
  resolveOrkesConfig,
  wrapFetchWithRetry,
} from "./helpers";
import type { OrkesApiConfig } from "../types";
import { createClient } from "../../open-api/generated/client";
import { addResourcesBackwardCompatibility } from "./helpers/addResourcesBackwardCompatibility";

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
  } = resolveOrkesConfig(config);

  if (!serverUrl) throw new Error("Conductor server URL is not set");

  const openApiClient = createClient({
    baseUrl: serverUrl,
    fetch: wrapFetchWithRetry(
      await resolveFetchFn(customFetch, maxHttp2Connections)
    ),
    throwOnError: true,
  });

  if (keyId && keySecret) {
    await handleAuth(openApiClient, keyId, keySecret, refreshTokenInterval);
  }

  // DEPRECATED, should be replaced with return openApiClient after April 2026:
  return addResourcesBackwardCompatibility(openApiClient);
};
