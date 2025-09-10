import type { OpenAPIConfig } from "../common";
import { BaseHttpRequest } from "../common";
import { ConductorClient } from "../common";
import { Resolver } from "../common/open-api/core/OpenAPI";
import { OrkesHttpRequest } from "./request/OrkesHttpRequest";
import { FetchFn, OrkesApiConfig, OrkesConductorClientAPIConfig } from "./types";

const REFRESH_TOKEN_IN_MILLISECONDS = 30 * 60 * 1000;

export class AuthConductorClient extends ConductorClient {
  public intervalId?: NodeJS.Timeout;
  public token?: string | Resolver<string>;
  
  constructor(
    config: Partial<OrkesConductorClientAPIConfig>,
    CustomHttpRequest?: new (config: OpenAPIConfig) => BaseHttpRequest
  ) {
    super(config, CustomHttpRequest);
  }
  /**
   * Stops the interval that refreshes the token
   */
  stop(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
    }
  }
}

/*
Returns an orkes conductor client creator function.
Usefull if you want to use your own fetch. like Got or Axios
 */
export const baseOrkesConductorClient = <
  T = RequestInit,
  R extends { json: () => Promise<any> } = Response
>(
  fetchFn: FetchFn<T, R>,
) => {
  const requestTokenForKeySecret = (
    keyId: string,
    keySecret: string,
    tokenUrl: string
  ) =>
    fetchFn(tokenUrl, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ keyId, keySecret }),
      method: "POST",
    } as any);

  return async (
    config?: Partial<OrkesApiConfig>,
    CustomHttpRequest: new (config: OpenAPIConfig) => BaseHttpRequest = OrkesHttpRequest
  ): Promise<ConductorClient> => {
    if (config?.useEnvVars) {
      if (!process.env.CONDUCTOR_SERVER_URL) {
        throw new Error(
          "Environment variable CONDUCTOR_SERVER_URL is not defined."
        );
      }

      config.BASE = process.env.CONDUCTOR_SERVER_URL;
      config.keyId = process.env.CONDUCTOR_AUTH_KEY;
      config.keySecret = process.env.CONDUCTOR_AUTH_SECRET;
    }

    if (config?.keySecret != null && config?.keyId != null) {
      const {
        BASE,
        keyId,
        keySecret,
        refreshTokenInterval = REFRESH_TOKEN_IN_MILLISECONDS,
      } = config;
      const tokenUrl = `${BASE}/token`;
      const res = await requestTokenForKeySecret(keyId, keySecret, tokenUrl);
      const { token } = await (res as R).json();

      const conductorClientInstance = new AuthConductorClient(
        {
          ...config,
          TOKEN: token,
        },
        CustomHttpRequest
      );

      if (token != null && refreshTokenInterval > 0) {
        const intervalId = setInterval(async () => {
          const res = await requestTokenForKeySecret(
            keyId,
            keySecret,
            tokenUrl
          );
          const { token } = await res.json();
          conductorClientInstance.token = token;
        }, refreshTokenInterval);
        conductorClientInstance.intervalId = intervalId;
      }

      return conductorClientInstance;
    } else {
      return new ConductorClient(config, CustomHttpRequest);
    }
  };
};
