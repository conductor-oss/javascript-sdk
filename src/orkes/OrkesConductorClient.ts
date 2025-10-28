import {
  handleAuth,
  resolveFetchFn,
  resolveOrkesConfig,
  wrapFetchWithRetry,
} from "./helpers";
import type { OrkesApiConfig } from "./types";
import { createClient } from "../common/open-api/client";
import { addServicesBackwardCompatibility } from "./helpers/addServicesBackwardCompatibility";

/**
 * Takes a config with keyId and keySecret returns a promise with an instance of Client
 *
 * @param config (optional) OrkesApiConfig with keyId and keySecret
 * @param customFetch (optional) custom fetch function
 * @param requestHandler DEPRECATED! (optional) ConductorHttpRequest handler, replaced with customFetch
 * @returns
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

  addServicesBackwardCompatibility(openApiClient); // DEPRECATED, should be removed after April 2026

  return openApiClient;
};
