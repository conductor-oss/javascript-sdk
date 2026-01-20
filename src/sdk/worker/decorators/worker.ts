import type { Task, TaskResult } from "../../../open-api";
import type { TaskDef } from "../../../open-api/generated";
import { registerWorker, type RegisteredWorker } from "./registry";

/**
 * Options for the @worker decorator.
 */
export interface WorkerOptions {
  /** 
   * Task definition name (must match workflow task name).
   * This is the only required parameter.
   */
  taskDefName: string;

  /**
   * Maximum concurrent tasks this worker can execute.
   * - Default: 1
   * - Controls concurrency level for task execution
   * - Choose based on workload:
   *   * CPU-bound: 1-4
   *   * I/O-bound: 10-50
   *   * Mixed: 5-20
   */
  concurrency?: number;

  /**
   * Polling interval in milliseconds.
   * - Default: 100ms
   * - Lower values = more responsive but higher server load
   * - Higher values = less server load but slower task pickup
   * - Recommended: 100-500ms for most use cases
   */
  pollInterval?: number;

  /**
   * Task domain for multi-tenancy.
   * - Default: undefined (no domain isolation)
   * - Use when you need to partition tasks across different environments/tenants
   */
  domain?: string;

  /**
   * Unique worker identifier.
   * - Default: undefined (auto-generated)
   * - Useful for debugging and tracking which worker executed which task
   */
  workerId?: string;

  /**
   * Auto-register task definition on startup.
   * - Default: false
   * - When true: Task definition is created/updated on worker startup
   * - When false: Task definition must exist in Conductor already
   * - Recommended: false for production (manage task definitions separately)
   */
  registerTaskDef?: boolean;

  /**
   * Server-side long poll timeout in milliseconds.
   * - Default: 100ms
   * - How long the server will wait for a task before returning empty response
   * - Higher values reduce polling frequency when no tasks available
   * - Recommended: 100-500ms
   */
  pollTimeout?: number;

  /**
   * Task definition template for registration.
   * - Default: undefined
   * - Only used when registerTaskDef=true
   * - Allows specifying retry policies, timeouts, rate limits, etc.
   * - The taskDefName parameter takes precedence for the name field
   */
  taskDef?: TaskDef;

  /**
   * Overwrite existing task definitions on server.
   * - Default: true
   * - When true: Always updates task definition
   * - When false: Only creates if doesn't exist
   * - Can be overridden via env: CONDUCTOR_WORKER_<NAME>_OVERWRITE_TASK_DEF=false
   */
  overwriteTaskDef?: boolean;

  /**
   * Enforce strict JSON schema validation.
   * - Default: false
   * - When false: additionalProperties=true (allows extra fields)
   * - When true: additionalProperties=false (strict validation)
   * - Can be overridden via env: CONDUCTOR_WORKER_<NAME>_STRICT_SCHEMA=true
   */
  strictSchema?: boolean;
}

/**
 * Decorator to register a function as a Conductor worker.
 * 
 * This decorator enables SDK-style worker registration with auto-discovery,
 * matching the Python SDK's @worker_task pattern.
 * 
 * @param options - Worker configuration options
 * 
 * @example
 * Basic usage:
 * ```typescript
 * @worker({ taskDefName: "process_order" })
 * async function processOrder(task: Task): Promise<TaskResult> {
 *   const orderId = task.inputData.orderId;
 *   // Process order logic
 *   return {
 *     status: "COMPLETED",
 *     outputData: { orderId, processed: true },
 *   };
 * }
 * ```
 * 
 * @example
 * With concurrency:
 * ```typescript
 * @worker({ taskDefName: "send_email", concurrency: 10 })
 * async function sendEmail(task: Task): Promise<TaskResult> {
 *   const { to, subject, body } = task.inputData;
 *   await emailService.send(to, subject, body);
 *   return { status: "COMPLETED", outputData: { sent: true } };
 * }
 * ```
 * 
 * @example
 * With domain and custom polling:
 * ```typescript
 * @worker({
 *   taskDefName: "validate_payment",
 *   domain: "payments",
 *   concurrency: 5,
 *   pollInterval: 200,
 * })
 * async function validatePayment(task: Task): Promise<TaskResult> {
 *   // Validation logic
 *   return { status: "COMPLETED", outputData: { valid: true } };
 * }
 * ```
 * 
 * @example
 * With task definition registration:
 * ```typescript
 * @worker({
 *   taskDefName: "complex_task",
 *   registerTaskDef: true,
 *   taskDef: {
 *     retryCount: 3,
 *     retryLogic: "EXPONENTIAL_BACKOFF",
 *     timeoutSeconds: 300,
 *   },
 * })
 * async function complexTask(task: Task): Promise<TaskResult> {
 *   // Complex logic
 *   return { status: "COMPLETED", outputData: { result: "..." } };
 * }
 * ```
 * 
 * @example
 * Non-retryable errors:
 * ```typescript
 * import { worker, NonRetryableException } from "@io-orkes/conductor-javascript/worker";
 * 
 * @worker({ taskDefName: "validate_order" })
 * async function validateOrder(task: Task): Promise<TaskResult> {
 *   const order = await getOrder(task.inputData.orderId);
 *   
 *   if (!order) {
 *     // Order doesn't exist - retry won't help
 *     throw new NonRetryableException(`Order ${task.inputData.orderId} not found`);
 *   }
 *   
 *   return { status: "COMPLETED", outputData: { validated: true } };
 * }
 * ```
 */
export function worker(options: WorkerOptions) {
  return function (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor
  ) {
    // Extract the function to register
    const executeFunction = descriptor?.value || target;

    // Validate that we have a function
    if (typeof executeFunction !== "function") {
      throw new Error(
        `@worker decorator can only be applied to functions. ` +
        `Received: ${typeof executeFunction}`
      );
    }

    // Validate required options
    if (!options.taskDefName) {
      throw new Error(
        `@worker decorator requires 'taskDefName' option. ` +
        `Example: @worker({ taskDefName: "my_task" })`
      );
    }

    // Create registered worker metadata
    const registeredWorker: RegisteredWorker = {
      taskDefName: options.taskDefName,
      executeFunction: executeFunction as (task: Task) => Promise<Omit<TaskResult, "workflowInstanceId" | "taskId">>,
      concurrency: options.concurrency,
      pollInterval: options.pollInterval,
      domain: options.domain,
      workerId: options.workerId,
      registerTaskDef: options.registerTaskDef,
      pollTimeout: options.pollTimeout,
      taskDef: options.taskDef,
      overwriteTaskDef: options.overwriteTaskDef,
      strictSchema: options.strictSchema,
    };

    // Register in global registry for auto-discovery
    registerWorker(registeredWorker);

    // Return original descriptor/target unchanged
    // This allows the function to be called normally
    return descriptor || target;
  };
}
