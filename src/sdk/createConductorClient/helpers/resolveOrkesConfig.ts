import { REFRESH_TOKEN_IN_MILLISECONDS } from "../constants";
import type { OrkesApiConfig } from "../../types";

export const resolveOrkesConfig = (config?: Partial<OrkesApiConfig>) => {
  let serverUrl = process.env.CONDUCTOR_SERVER_URL || config?.serverUrl;
  if (serverUrl?.endsWith("/")) serverUrl = serverUrl.slice(0, -1);
  if (serverUrl?.endsWith("/api")) serverUrl = serverUrl.slice(0, -4);

  return {
    serverUrl,
    keyId: process.env.CONDUCTOR_AUTH_KEY || config?.keyId,
    keySecret: process.env.CONDUCTOR_AUTH_SECRET || config?.keySecret,
    maxHttp2Connections:
      Number(process.env.CONDUCTOR_MAX_HTTP2_CONNECTIONS) ||
      config?.maxHttp2Connections,
    refreshTokenInterval:
      Number(process.env.CONDUCTOR_REFRESH_TOKEN_INTERVAL) ||
      config?.refreshTokenInterval ||
      REFRESH_TOKEN_IN_MILLISECONDS,
  };
};
