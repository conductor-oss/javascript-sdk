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
  MetricsServer,
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
