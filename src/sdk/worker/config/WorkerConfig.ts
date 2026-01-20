import type { ConductorLogger } from "../../helpers/logger";
import { DefaultLogger } from "../../helpers/logger";

/**
 * Worker configuration properties that can be overridden via environment variables.
 */
export interface WorkerConfig {
  /** Polling interval in milliseconds */
  pollInterval?: number;
  
  /** Task domain for multi-tenancy */
  domain?: string;
  
  /** Unique worker identifier */
  workerId?: string;
  
  /** Maximum concurrent tasks */
  concurrency?: number;
  
  /** Auto-register task definition on startup */
  registerTaskDef?: boolean;
  
  /** Server-side long poll timeout in milliseconds */
  pollTimeout?: number;
  
  /** Whether worker is paused */
  paused?: boolean;
  
  /** Overwrite existing task definitions */
  overwriteTaskDef?: boolean;
  
  /** Enforce strict JSON schema validation */
  strictSchema?: boolean;
}

/**
 * Configurable property names and their types.
 */
const CONFIGURABLE_PROPERTIES: Array<keyof WorkerConfig> = [
  "pollInterval",
  "domain",
  "workerId",
  "concurrency",
  "registerTaskDef",
  "pollTimeout",
  "paused",
  "overwriteTaskDef",
  "strictSchema",
];

/**
 * Type mapping for configuration properties.
 */
const PROPERTY_TYPES: Record<keyof WorkerConfig, "number" | "string" | "boolean"> = {
  pollInterval: "number",
  domain: "string",
  workerId: "string",
  concurrency: "number",
  registerTaskDef: "boolean",
  pollTimeout: "number",
  paused: "boolean",
  overwriteTaskDef: "boolean",
  strictSchema: "boolean",
};

/**
 * Default values for configuration properties.
 */
const DEFAULT_VALUES: Partial<WorkerConfig> = {
  pollInterval: 100,
  concurrency: 1,
  registerTaskDef: false,
  pollTimeout: 100,
  paused: false,
  overwriteTaskDef: true,
  strictSchema: false,
};

/**
 * Parse environment variable value to the expected type.
 */
function parseEnvValue(
  value: string,
  expectedType: "number" | "string" | "boolean",
  logger?: ConductorLogger
): number | string | boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  // Handle boolean values
  if (expectedType === "boolean") {
    const lower = value.toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes" || lower === "on";
  }

  // Handle number values
  if (expectedType === "number") {
    const parsed = Number(value);
    if (isNaN(parsed)) {
      logger?.info(`Cannot convert '${value}' to number, ignoring invalid value`);
      return undefined;
    }
    return parsed;
  }

  // String values
  return value;
}

/**
 * Convert camelCase property name to snake_case for environment variables.
 * 
 * Examples:
 * - pollInterval → poll_interval
 * - workerId → worker_id
 * - registerTaskDef → register_task_def
 */
function toSnakeCase(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Get configuration value from environment variables with hierarchical lookup.
 * 
 * Priority order (highest to lowest):
 * 1. CONDUCTOR_WORKER_<WORKER_NAME>_<PROPERTY> - Worker-specific (uppercase)
 * 2. conductor.worker.<worker_name>.<property> - Worker-specific (dotted)
 * 3. CONDUCTOR_WORKER_ALL_<PROPERTY> - Global (uppercase)
 * 4. conductor.worker.all.<property> - Global (dotted)
 * 
 * @param workerName - Task definition name
 * @param propertyName - Property name in camelCase (e.g., "pollInterval")
 * @param expectedType - Expected type for parsing
 * @param logger - Optional logger for debug messages
 */
function getEnvValue(
  workerName: string,
  propertyName: keyof WorkerConfig,
  expectedType: "number" | "string" | "boolean",
  logger?: ConductorLogger
): number | string | boolean | undefined {
  const snakeCase = toSnakeCase(propertyName);

  // 1. Worker-specific (uppercase): CONDUCTOR_WORKER_<WORKER_NAME>_<PROPERTY>
  const workerSpecificUpper = `CONDUCTOR_WORKER_${workerName.toUpperCase()}_${snakeCase.toUpperCase()}`;
  let value = process.env[workerSpecificUpper];
  if (value !== undefined) {
    logger?.debug(`Using worker-specific config: ${workerSpecificUpper}=${value}`);
    return parseEnvValue(value, expectedType, logger);
  }

  // 2. Worker-specific (dotted): conductor.worker.<worker_name>.<property>
  const workerSpecificDotted = `conductor.worker.${workerName}.${snakeCase}`;
  value = process.env[workerSpecificDotted];
  if (value !== undefined) {
    logger?.debug(`Using worker-specific config: ${workerSpecificDotted}=${value}`);
    return parseEnvValue(value, expectedType, logger);
  }

  // 3. Global (uppercase): CONDUCTOR_WORKER_ALL_<PROPERTY>
  const globalUpper = `CONDUCTOR_WORKER_ALL_${snakeCase.toUpperCase()}`;
  value = process.env[globalUpper];
  if (value !== undefined) {
    logger?.debug(`Using global worker config: ${globalUpper}=${value}`);
    return parseEnvValue(value, expectedType, logger);
  }

  // 4. Global (dotted): conductor.worker.all.<property>
  const globalDotted = `conductor.worker.all.${snakeCase}`;
  value = process.env[globalDotted];
  if (value !== undefined) {
    logger?.debug(`Using global worker config: ${globalDotted}=${value}`);
    return parseEnvValue(value, expectedType, logger);
  }

  return undefined;
}

/**
 * Resolve worker configuration with hierarchical override.
 * 
 * Configuration hierarchy (highest to lowest priority):
 * 1. Worker-specific environment variables
 * 2. Global worker environment variables
 * 3. Code-level defaults (decorator/function parameters)
 * 4. System defaults
 * 
 * @param workerName - Task definition name
 * @param codeDefaults - Configuration from code (decorator parameters)
 * @param logger - Optional logger for debug messages
 * 
 * @example
 * ```typescript
 * // Code has: pollInterval: 1000
 * // Env has: CONDUCTOR_WORKER_ALL_POLL_INTERVAL=500
 * // Result: pollInterval=500
 * 
 * const config = resolveWorkerConfig("process_order", {
 *   pollInterval: 1000,
 *   domain: "dev",
 * });
 * // config = { pollInterval: 500, domain: "dev", ... }
 * ```
 */
export function resolveWorkerConfig(
  workerName: string,
  codeDefaults: Partial<WorkerConfig> = {},
  logger?: ConductorLogger
): WorkerConfig {
  const resolved: WorkerConfig = {};

  for (const property of CONFIGURABLE_PROPERTIES) {
    const expectedType = PROPERTY_TYPES[property];

    // 1. Check environment variables (worker-specific > global)
    const envValue = getEnvValue(workerName, property, expectedType, logger);
    if (envValue !== undefined) {
      (resolved as any)[property] = envValue;
      continue;
    }

    // 2. Use code default if provided
    if (codeDefaults[property] !== undefined) {
      (resolved as any)[property] = codeDefaults[property];
      continue;
    }

    // 3. Use system default
    if (DEFAULT_VALUES[property] !== undefined) {
      (resolved as any)[property] = DEFAULT_VALUES[property];
    }
  }

  return resolved;
}

/**
 * Generate a human-readable summary of worker configuration resolution.
 * 
 * @param workerName - Task definition name
 * @param resolvedConfig - Resolved configuration
 * @param logger - Optional logger
 * 
 * @example
 * ```typescript
 * const summary = getWorkerConfigSummary("process_order", config);
 * console.log(summary);
 * // Worker 'process_order' configuration:
 * //   pollInterval: 500 (from CONDUCTOR_WORKER_ALL_POLL_INTERVAL)
 * //   domain: production (from CONDUCTOR_WORKER_PROCESS_ORDER_DOMAIN)
 * //   concurrency: 5 (from code)
 * ```
 */
export function getWorkerConfigSummary(
  workerName: string,
  resolvedConfig: WorkerConfig,
  logger?: ConductorLogger
): string {
  const lines: string[] = [`Worker '${workerName}' configuration:`];

  for (const [key, value] of Object.entries(resolvedConfig)) {
    if (value === undefined || value === null) {
      continue;
    }

    const property = key as keyof WorkerConfig;
    const snakeCase = toSnakeCase(property);

    // Determine source of configuration
    let source = "from code";

    // Check worker-specific env vars
    const workerSpecificUpper = `CONDUCTOR_WORKER_${workerName.toUpperCase()}_${snakeCase.toUpperCase()}`;
    const workerSpecificDotted = `conductor.worker.${workerName}.${snakeCase}`;

    if (process.env[workerSpecificUpper] !== undefined) {
      source = `from ${workerSpecificUpper}`;
    } else if (process.env[workerSpecificDotted] !== undefined) {
      source = `from ${workerSpecificDotted}`;
    } else {
      // Check global env vars
      const globalUpper = `CONDUCTOR_WORKER_ALL_${snakeCase.toUpperCase()}`;
      const globalDotted = `conductor.worker.all.${snakeCase}`;

      if (process.env[globalUpper] !== undefined) {
        source = `from ${globalUpper}`;
      } else if (process.env[globalDotted] !== undefined) {
        source = `from ${globalDotted}`;
      }
    }

    lines.push(`  ${property}: ${value} (${source})`);
  }

  return lines.join("\n");
}

/**
 * Generate a compact single-line summary of worker configuration.
 * 
 * @param workerName - Task definition name
 * @param resolvedConfig - Resolved configuration
 * 
 * @example
 * ```typescript
 * const summary = getWorkerConfigOneline("process_order", config);
 * console.log(summary);
 * // Conductor Worker[name=process_order, pid=12345, status=active, poll_interval=500ms, domain=production, concurrency=5]
 * ```
 */
export function getWorkerConfigOneline(
  workerName: string,
  resolvedConfig: WorkerConfig
): string {
  const parts: string[] = [`name=${workerName}`];

  // Add process ID
  parts.push(`pid=${process.pid}`);

  // Add status (paused or active)
  const isPaused = resolvedConfig.paused ?? false;
  parts.push(`status=${isPaused ? "paused" : "active"}`);

  // Add other properties in a logical order
  if (resolvedConfig.pollInterval !== undefined) {
    parts.push(`poll_interval=${resolvedConfig.pollInterval}ms`);
  }

  if (resolvedConfig.domain !== undefined) {
    parts.push(`domain=${resolvedConfig.domain}`);
  }

  if (resolvedConfig.concurrency !== undefined) {
    parts.push(`concurrency=${resolvedConfig.concurrency}`);
  }

  if (resolvedConfig.pollTimeout !== undefined) {
    parts.push(`poll_timeout=${resolvedConfig.pollTimeout}ms`);
  }

  if (resolvedConfig.registerTaskDef !== undefined) {
    parts.push(`register_task_def=${resolvedConfig.registerTaskDef}`);
  }

  return `Conductor Worker[${parts.join(", ")}]`;
}
