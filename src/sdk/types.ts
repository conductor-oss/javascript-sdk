import type { TaskResult } from "../open-api";
import type { ConductorLogger } from "./helpers/logger";

export type TaskResultStatus = NonNullable<TaskResult["status"]>;
export type TaskResultOutputData = NonNullable<TaskResult["outputData"]>;

export interface OrkesApiConfig {
  serverUrl?: string;
  keyId?: string;
  keySecret?: string;
  refreshTokenInterval?: number;
  useEnvVars?: boolean; // DEPRECATED, has no effect
  maxHttp2Connections?: number; // max number of simultaneous http connections to the conductor server
  logger?: ConductorLogger; // logger for auth diagnostics
  requestTimeoutMs?: number; // per-request timeout in milliseconds
  connectTimeoutMs?: number; // TCP connect timeout in milliseconds (default 10s)
  tlsCertPath?: string; // path to TLS client certificate (for mTLS)
  tlsKeyPath?: string; // path to TLS client key (for mTLS)
  tlsCaPath?: string; // path to TLS CA certificate bundle
  proxyUrl?: string; // HTTP/HTTPS proxy URL
  tlsInsecure?: boolean; // disable TLS certificate verification (for self-signed certs)
  disableHttp2?: boolean; // force HTTP/1.1 instead of HTTP/2
}
