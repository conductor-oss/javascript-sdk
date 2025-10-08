import { OrkesApiConfig } from "../types";

export const resolveOrkesConfig = (config?: Partial<OrkesApiConfig>) => {
  return {
    serverUrl: process.env.CONDUCTOR_SERVER_URL || config?.serverUrl,
    keyId: process.env.CONDUCTOR_AUTH_KEY || config?.keyId,
    keySecret: process.env.CONDUCTOR_AUTH_SECRET || config?.keySecret,
    refreshTokenInterval:
      Number(process.env.CONDUCTOR_REFRESH_TOKEN_INTERVAL) ||
      config?.maxHttp2Connections,
    maxHttp2Connections:
      Number(process.env.CONDUCTOR_MAX_HTTP2_CONNECTIONS) ||
      config?.maxHttp2Connections,
  };
};
