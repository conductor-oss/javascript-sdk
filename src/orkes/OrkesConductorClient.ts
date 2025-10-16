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
  // todo: remove undefined from client methods + throw error instead, replace all default errors with sdk error
  // todo: decide if to keep FetchFn type
  // todo: add logging for silent operations (auth refresh, etc?) using sdk logger
  // todo: build a list of OpenApi spec mistakes

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
