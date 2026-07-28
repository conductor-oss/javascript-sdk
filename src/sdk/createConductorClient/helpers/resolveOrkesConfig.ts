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
 * Read a `CONDUCTOR_AGENT_*` var, falling back to its deprecated `AGENTSPAN_*`
 * spelling and warning once per legacy name.
 *
 * Duplicated rather than shared with `src/agents/legacy-env.ts` because the
 * agent layer must not import from `src/sdk` outside `agent-client.ts` and
 * `worker.ts` (see AGENTS.md).
 */
const agentEnv = (suffix: string, logger: ConductorLogger): string | undefined => {
  const canonical = `CONDUCTOR_AGENT_${suffix}`;
  const legacy = `AGENTSPAN_${suffix}`;

  const current = process.env[canonical];
  if (current !== undefined && current !== "") return current;

  const legacyValue = process.env[legacy];
  if (legacyValue === undefined || legacyValue === "") return undefined;

  if (!legacyEnvWarned.has(legacy)) {
    legacyEnvWarned.add(legacy);
    // ConductorLogger.warn is optional; fall back to info so the deprecation
    // is never silently dropped by a custom logger.
    const emit = logger.warn?.bind(logger) ?? logger.info.bind(logger);
    emit(
      `${legacy} is deprecated and will be removed in a future release. Use ${canonical} instead.`,
    );
  }
  return legacyValue;
};

export const resolveOrkesConfig = (config?: Partial<OrkesApiConfig>) => {
  const logger = config?.logger ?? new DefaultLogger();

  // R3: CONDUCTOR_* env -> explicit config -> CONDUCTOR_AGENT_* env (agent-layer
  // fallback, with deprecated AGENTSPAN_* spelling) -> localhost:8080 default.
  let serverUrl =
    process.env.CONDUCTOR_SERVER_URL ||
    config?.serverUrl ||
    agentEnv("SERVER_URL", logger) ||
    "http://localhost:8080";
  if (serverUrl.endsWith("/")) serverUrl = serverUrl.slice(0, -1);
  if (serverUrl.endsWith("/api")) serverUrl = serverUrl.slice(0, -4);

  // Trim to avoid "Invalid Access Key" from trailing newlines when pasting into GitHub Secrets or .env
  const keyId = (
    process.env.CONDUCTOR_AUTH_KEY ||
    config?.keyId ||
    agentEnv("AUTH_KEY", logger) ||
    ""
  ).trim();
  const keySecret = (
    process.env.CONDUCTOR_AUTH_SECRET ||
    config?.keySecret ||
    agentEnv("AUTH_SECRET", logger) ||
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
