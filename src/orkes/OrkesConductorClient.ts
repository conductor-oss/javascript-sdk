import { handleAuth, resolveFetchFn, resolveOrkesConfig } from "./helpers";
import type { FetchFn, OrkesApiConfig } from "./types";
import { createClient } from "../common/open-api/client";

/**
 * Takes a config with keyId and keySecret returns a promise with an instance of ConductorClient
 *
 * @param config (optional) OrkesApiConfig with keyId and keySecret
 * @param customFetch (optional) custom fetch function
 * @param requestHandler DEPRECATED! (optional) ConductorHttpRequest handler, replaced with customFetch
 * @returns
 */
export const orkesConductorClient = async (
  config?: OrkesApiConfig,
  customFetch?: FetchFn
) => {
  const {
    serverUrl,
    keyId,
    keySecret,
    maxHttp2Connections,
    refreshTokenInterval,
  } = resolveOrkesConfig(config);

  if (!serverUrl) throw new Error("Conductor server URL is not set");
  // todo: retry on 429
  // todo: resolve types
  // todo: decide if should return undefined from client methods
  // todo: logging

  const openApiClient = createClient({
    baseUrl: serverUrl,
    fetch: await resolveFetchFn(customFetch, maxHttp2Connections),
    throwOnError: true,
  });

  if (keyId && keySecret) {
    await handleAuth(openApiClient, keyId, keySecret, refreshTokenInterval);
  }

  return openApiClient;
};
