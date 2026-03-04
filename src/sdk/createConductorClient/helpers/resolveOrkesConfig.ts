import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  REFRESH_TOKEN_IN_MILLISECONDS,
} from "../constants";
import type { OrkesApiConfig } from "../../types";

/**
 * Parse an env var as a number, returning undefined if absent or NaN.
 * Unlike `Number(x) || fallback`, this correctly handles "0".
 */
const parseEnvNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const parseEnvBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined || value === "") return undefined;
  return value.toLowerCase() === "true" || value === "1";
};

export const resolveOrkesConfig = (config?: Partial<OrkesApiConfig>) => {
  let serverUrl = process.env.CONDUCTOR_SERVER_URL || config?.serverUrl;
  if (serverUrl?.endsWith("/")) serverUrl = serverUrl.slice(0, -1);
  if (serverUrl?.endsWith("/api")) serverUrl = serverUrl.slice(0, -4);

  return {
    serverUrl,
    keyId: process.env.CONDUCTOR_AUTH_KEY || config?.keyId,
    keySecret: process.env.CONDUCTOR_AUTH_SECRET || config?.keySecret,
    maxHttp2Connections:
      parseEnvNumber(process.env.CONDUCTOR_MAX_HTTP2_CONNECTIONS) ??
      config?.maxHttp2Connections,
    refreshTokenInterval:
      parseEnvNumber(process.env.CONDUCTOR_REFRESH_TOKEN_INTERVAL) ??
      config?.refreshTokenInterval ??
      REFRESH_TOKEN_IN_MILLISECONDS,
    logger: config?.logger,
    requestTimeoutMs:
      parseEnvNumber(process.env.CONDUCTOR_REQUEST_TIMEOUT_MS) ??
      config?.requestTimeoutMs ??
      DEFAULT_REQUEST_TIMEOUT_MS,
    connectTimeoutMs:
      parseEnvNumber(process.env.CONDUCTOR_CONNECT_TIMEOUT_MS) ??
      config?.connectTimeoutMs ??
      DEFAULT_CONNECT_TIMEOUT_MS,
    tlsCertPath: process.env.CONDUCTOR_TLS_CERT_PATH || config?.tlsCertPath,
    tlsKeyPath: process.env.CONDUCTOR_TLS_KEY_PATH || config?.tlsKeyPath,
    tlsCaPath: process.env.CONDUCTOR_TLS_CA_PATH || config?.tlsCaPath,
    proxyUrl: process.env.CONDUCTOR_PROXY_URL || config?.proxyUrl,
    tlsInsecure:
      parseEnvBoolean(process.env.CONDUCTOR_TLS_INSECURE) ??
      config?.tlsInsecure,
    disableHttp2:
      parseEnvBoolean(process.env.CONDUCTOR_DISABLE_HTTP2) ??
      config?.disableHttp2,
  };
};
