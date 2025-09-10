import { baseOrkesConductorClient } from "./BaseOrkesConductorClient";

/**
 * Takes a config with keyId and keySecret returns a promise with an instance of ConductorClient
 *
 * @param config ConductorClientConfig with keyId and keySecret
 * @param CustomHttpRequest (optional) custom http request handler class extending BaseHttpRequest
 * @returns
 */
export const orkesConductorClient = baseOrkesConductorClient(fetch);
