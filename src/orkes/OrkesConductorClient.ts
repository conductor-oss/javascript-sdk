import {
  handleAuth,
  resolveFetchFn,
  resolveOrkesConfig,
  wrapFetchWithRetry,
} from "./helpers";
import type { OrkesApiConfig } from "./types";
import { createClient } from "../common/open-api/client";
import { addResourcesBackwardCompatibility } from "./helpers/addResourcesBackwardCompatibility";

/**
 * Takes a config with keyId and keySecret returns a promise with an instance of Client
 *
 * @param config (optional) OrkesApiConfig with keyId and keySecret
 * @param customFetch (optional) custom fetch function
 * @param requestHandler DEPRECATED! (optional) ConductorHttpRequest handler, replaced with customFetch
 * @returns BackwardCompatibleClient with access to deprecated resource methods
 */
export const orkesConductorClient = async (
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
