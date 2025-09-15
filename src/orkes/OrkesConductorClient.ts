import { ConductorClientWithAuth } from "./ConductorClientWithAuth";
import { OrkesHttpRequest } from "./request/OrkesHttpRequest";
import { HttpRequestConstructor, OrkesApiConfig } from "./types";

const REFRESH_TOKEN_IN_MILLISECONDS = 30 * 60 * 1000;

/**
 * Takes a config with keyId and keySecret returns a promise with an instance of ConductorClient
 *
 * @param config (optional) OrkesApiConfig with keyId and keySecret
 * @param HttpRequest (optional) Custom request class, could be used to pass in a custom fetch function
 * @returns
 */
export const orkesConductorClient = async (
  config?: Partial<OrkesApiConfig>,
  HttpRequest: HttpRequestConstructor = OrkesHttpRequest
) => {
  const serverUrl = process.env.CONDUCTOR_SERVER_URL || config?.serverUrl;

  if (!serverUrl) throw new Error("Conductor server URL is not set");

  const keyId = process.env.CONDUCTOR_AUTH_KEY || config?.keyId;
  const keySecret = process.env.CONDUCTOR_AUTH_SECRET || config?.keySecret;

  const conductorClientWithAuth = new ConductorClientWithAuth(
    { ...config, BASE: serverUrl },
    HttpRequest
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
