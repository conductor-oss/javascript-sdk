import { config as dotenvConfig } from "dotenv";
import { readRenamedEnv } from "./legacy-env.js";

// Load .env file on import (no-op if file doesn't exist)
dotenvConfig();

/**
 * Read a `CONDUCTOR_AGENT_*` knob, falling back to its deprecated
 * `AGENTSPAN_*` spelling. See {@link readRenamedEnv}.
 */
function agentEnv(suffix: string): string | undefined {
  return readRenamedEnv(`CONDUCTOR_AGENT_${suffix}`, `AGENTSPAN_${suffix}`);
}

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
    this.workerPollIntervalMs =
      options?.workerPollIntervalMs ?? parseIntEnv(agentEnv("WORKER_POLL_INTERVAL"), 100);

    this.workerThreadCount =
      options?.workerThreadCount ?? parseIntEnv(agentEnv("WORKER_THREADS"), 1);

    this.autoStartWorkers =
      options?.autoStartWorkers ?? parseBoolEnv(agentEnv("AUTO_START_WORKERS"), true);

    this.streamingEnabled =
      options?.streamingEnabled ?? parseBoolEnv(agentEnv("STREAMING_ENABLED"), true);

    this.livenessEnabled =
      options?.livenessEnabled ?? parseBoolEnv(agentEnv("LIVENESS_ENABLED"), true);

    this.livenessStallSeconds =
      options?.livenessStallSeconds ?? parseFloatEnv(agentEnv("LIVENESS_STALL_SECONDS"), 30.0);

    this.livenessCheckIntervalSeconds =
      options?.livenessCheckIntervalSeconds ??
      parseFloatEnv(agentEnv("LIVENESS_CHECK_INTERVAL_SECONDS"), 10.0);
  }

  /**
   * Create an AgentConfig from environment variables only (no overrides).
   */
  static fromEnv(): AgentConfig {
    return new AgentConfig();
  }
}
