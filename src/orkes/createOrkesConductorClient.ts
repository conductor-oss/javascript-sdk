import { ConductorClientWithAuth } from "./ConductorClientWithAuth";
import { resolveFetchFn, resolveOrkesConfig } from "./helpers";
import { createOrkesHttpRequest } from "./request/createOrkesHttpRequest";
import type { FetchFn, OrkesApiConfig } from "./types";
import { REFRESH_TOKEN_IN_MILLISECONDS } from "./constants";

/**
 * Takes a config with keyId and keySecret returns a promise with an instance of ConductorClient
 *
 * @param config (optional) OrkesApiConfig with keyId and keySecret
 * @param customFetch (optional) custom fetch function
 * @returns
 */
export const orkesConductorClient = async (
  config?: Partial<OrkesApiConfig>,
  customFetch?: FetchFn
) => {
  const { serverUrl, keyId, keySecret } = resolveOrkesConfig(config);

  if (!serverUrl) throw new Error("Conductor server URL is not set");

  const conductorClientWithAuth = new ConductorClientWithAuth(
    { ...config, BASE: serverUrl },
    createOrkesHttpRequest(resolveFetchFn(customFetch))
  );

  if (keyId && keySecret) {
    await conductorClientWithAuth.authorize(
      keyId,
      keySecret,
      config?.refreshTokenInterval || REFRESH_TOKEN_IN_MILLISECONDS
    );
  }

  return conductorClientWithAuth;
};
