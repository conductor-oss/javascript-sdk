// Core SDK
export { TaskHandler, type TaskHandlerConfig } from "./core";

// Decorators
export { worker, type WorkerOptions } from "./decorators/worker";
export {
  getRegisteredWorkers,
  getRegisteredWorker,
  clearWorkerRegistry,
  getWorkerCount,
  type RegisteredWorker,
} from "./decorators/registry";

// Context
export { TaskContext, getTaskContext } from "./context";

// Metrics
export {
  MetricsCollector,
  LegacyMetricsCollector,
  CanonicalMetricsCollector,
  createMetricsCollector,
  MetricsServer,
  type MetricsCollectorInterface,
  type MetricsCollectorConfig,
  type WorkerMetrics,
} from "./metrics";

// Schema
export {
  jsonSchema,
  schemaField,
  generateSchemaFromClass,
  type FieldDescriptor,
  type JsonSchemaType,
  type JsonSchemaOutput,
  type SchemaFieldOptions,
} from "./schema";

// Events (re-export from clients/worker for now)
export * from "../clients/worker/events";

// Exceptions (re-export from clients/worker for now)
export * from "../clients/worker/exceptions";

// Types
export type {
  ConductorWorker,
  TaskInProgressResult,
  HealthMonitorConfig,
} from "../clients/worker/types";
export { isTaskInProgress } from "../clients/worker/types";

// Lease extension
export { LeaseTracker, type LeaseInfo } from "../clients/worker/LeaseTracker";
export {
  LEASE_EXTEND_RETRY_COUNT,
  LEASE_EXTEND_DURATION_FACTOR,
  HEARTBEAT_CHECK_INTERVAL_MS,
  HEARTBEAT_RETRY_DELAY_MS,
} from "../clients/worker/constants";
