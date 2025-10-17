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
  /*
  1. AdditionalProperties nested objects instead of AdditionalProperties: {} or AdditionalProperties true
  2. Bare "type": "object" properties without additionalProperties (FieldDescriptor, EventMessage, etc)
  3. SignalResponse optional fields are missing
  4. ExtendedTaskDef totalTimeoutSeconds and timeoutSeconds are marked both as required (in fact they are optional)
  5. GET /api/metadata/taskdefs/{tasktype} should return TaskDef
  6. POST & GET /api/registry/service/protos/{registryName}/{filename} should accept Blob ("format": "binary"). Probably same for other endpoints accepting binary data.
  */

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
