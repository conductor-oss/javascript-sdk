import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  REFRESH_TOKEN_IN_MILLISECONDS,
} from "../constants";
import type { OrkesApiConfig } from "../../types";
import { DefaultLogger, type ConductorLogger } from "../../helpers/logger";

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

const legacyEnvWarned = new Set<string>();

/**
 * Read a deprecated `AGENTSPAN_*` connection variable, warning once per name.
 *
 * The agent layer's connection surface is now the core `CONDUCTOR_*` vars, so
 * each legacy name maps to its `CONDUCTOR_*` counterpart rather than to a
 * separate agent-layer tier. This sits *below* explicit config, so it only
 * applies when nothing else supplied a value.
 *
 * Duplicated rather than shared with `src/agents/legacy-env.ts` because the
 * agent layer must not import from `src/sdk` outside `agent-client.ts` and
 * `worker.ts` (see AGENTS.md).
 */
const legacyEnv = (legacy: string, canonical: string, logger: ConductorLogger) => {
  const value = process.env[legacy];
  if (value === undefined || value === "") return undefined;

  if (!legacyEnvWarned.has(legacy)) {
    legacyEnvWarned.add(legacy);
    // ConductorLogger.warn is optional; fall back to info so the deprecation
    // is never silently dropped by a custom logger.
    const emit = logger.warn?.bind(logger) ?? logger.info.bind(logger);
    emit(
      `${legacy} is deprecated and will be removed in a future release. Use ${canonical} instead.`,
    );
  }
  return value;
};

export const resolveOrkesConfig = (config?: Partial<OrkesApiConfig>) => {
  const logger = config?.logger ?? new DefaultLogger();

  // CONDUCTOR_* env -> explicit config -> deprecated AGENTSPAN_* env
  // -> localhost:8080 default.
  let serverUrl =
    process.env.CONDUCTOR_SERVER_URL ||
    config?.serverUrl ||
    legacyEnv("AGENTSPAN_SERVER_URL", "CONDUCTOR_SERVER_URL", logger) ||
    "http://localhost:8080";
  if (serverUrl.endsWith("/")) serverUrl = serverUrl.slice(0, -1);
  if (serverUrl.endsWith("/api")) serverUrl = serverUrl.slice(0, -4);

  // Trim to avoid "Invalid Access Key" from trailing newlines when pasting into GitHub Secrets or .env
  const keyId = (
    process.env.CONDUCTOR_AUTH_KEY ||
    config?.keyId ||
    legacyEnv("AGENTSPAN_AUTH_KEY", "CONDUCTOR_AUTH_KEY", logger) ||
    ""
  ).trim();
  const keySecret = (
    process.env.CONDUCTOR_AUTH_SECRET ||
    config?.keySecret ||
    legacyEnv("AGENTSPAN_AUTH_SECRET", "CONDUCTOR_AUTH_SECRET", logger) ||
    ""
  ).trim();

  if (!process.env.CONDUCTOR_AUTH_KEY) {
    logger.debug("CONDUCTOR_AUTH_KEY is not set");
  }

  if (!process.env.CONDUCTOR_AUTH_SECRET) {
    logger.debug("CONDUCTOR_AUTH_SECRET is not set");
  }

  return {
    serverUrl,
    keyId: keyId || undefined,
    keySecret: keySecret || undefined,
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
    retryServerErrors:
      parseEnvBoolean(process.env.CONDUCTOR_RETRY_SERVER_ERRORS) ??
      config?.retryServerErrors,
  };
};
