import { config as dotenvConfig } from "dotenv";

// Load .env file on import (no-op if file doesn't exist)
dotenvConfig();

/**
 * Parse a boolean from an environment variable string.
 * Recognizes 'true', '1', 'yes' as true; everything else as false.
 */
function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["true", "1", "yes"].includes(value.toLowerCase());
}

/**
 * Parse an integer from an environment variable string.
 */
function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a float from an environment variable string.
 */
function parseFloatEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Behavior-only agent runtime knobs (spec R4). Connection/auth/logging live
 * on the shared Conductor client's own config (`OrkesApiConfig`) — see
 * {@link AgentRuntime}'s `configuration` constructor parameter.
 */
export interface AgentConfigOptions {
  workerPollIntervalMs?: number;
  workerThreadCount?: number;
  autoStartWorkers?: boolean;
  streamingEnabled?: boolean;
  livenessEnabled?: boolean;
  livenessStallSeconds?: number;
  livenessCheckIntervalSeconds?: number;
}

/**
 * Behavior-only agent runtime configuration, with env var fallback.
 */
export class AgentConfig {
  readonly workerPollIntervalMs: number;
  readonly workerThreadCount: number;
  readonly autoStartWorkers: boolean;
  readonly streamingEnabled: boolean;
  readonly livenessEnabled: boolean;
  readonly livenessStallSeconds: number;
  readonly livenessCheckIntervalSeconds: number;

  constructor(options?: AgentConfigOptions) {
    const env = process.env;

    // CONDUCTOR_* env -> AGENTSPAN_* env (agent-layer fallback), same shape
    // as resolveOrkesConfig.ts's connection-config precedence.
    this.workerPollIntervalMs =
      options?.workerPollIntervalMs ??
      parseIntEnv(env.CONDUCTOR_WORKER_POLL_INTERVAL || env.AGENTSPAN_WORKER_POLL_INTERVAL, 100);

    this.workerThreadCount =
      options?.workerThreadCount ??
      parseIntEnv(env.CONDUCTOR_WORKER_THREADS || env.AGENTSPAN_WORKER_THREADS, 1);

    this.autoStartWorkers =
      options?.autoStartWorkers ??
      parseBoolEnv(env.CONDUCTOR_AUTO_START_WORKERS || env.AGENTSPAN_AUTO_START_WORKERS, true);

    this.streamingEnabled =
      options?.streamingEnabled ??
      parseBoolEnv(env.CONDUCTOR_STREAMING_ENABLED || env.AGENTSPAN_STREAMING_ENABLED, true);

    this.livenessEnabled =
      options?.livenessEnabled ??
      parseBoolEnv(env.CONDUCTOR_LIVENESS_ENABLED || env.AGENTSPAN_LIVENESS_ENABLED, true);

    this.livenessStallSeconds =
      options?.livenessStallSeconds ??
      parseFloatEnv(
        env.CONDUCTOR_LIVENESS_STALL_SECONDS || env.AGENTSPAN_LIVENESS_STALL_SECONDS,
        30.0,
      );

    this.livenessCheckIntervalSeconds =
      options?.livenessCheckIntervalSeconds ??
      parseFloatEnv(
        env.CONDUCTOR_LIVENESS_CHECK_INTERVAL_SECONDS ||
          env.AGENTSPAN_LIVENESS_CHECK_INTERVAL_SECONDS,
        10.0,
      );
  }

  /**
   * Create an AgentConfig from environment variables only (no overrides).
   */
  static fromEnv(): AgentConfig {
    return new AgentConfig();
  }
}
