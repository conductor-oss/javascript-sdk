import type { Task, TaskResult } from "../../../open-api";
import type { TaskDef } from "../../../open-api/generated";

/**
 * Registered worker metadata stored in the global registry.
 */
export interface RegisteredWorker {
  /** Task definition name (must match workflow task name) */
  taskDefName: string;
  
  /** Worker execution function */
  executeFunction: (task: Task) => Promise<Omit<TaskResult, "workflowInstanceId" | "taskId">>;
  
  /** Maximum concurrent tasks (default: 1) */
  concurrency?: number;
  
  /** Polling interval in milliseconds (default: 100) */
  pollInterval?: number;
  
  /** Task domain for multi-tenancy (default: undefined) */
  domain?: string;
  
  /** Unique worker identifier (default: auto-generated) */
  workerId?: string;
  
  /** Auto-register task definition on startup (default: false) */
  registerTaskDef?: boolean;
  
  /** Server-side long poll timeout in milliseconds (default: 100) */
  pollTimeout?: number;
  
  /** Task definition template for registration (optional) */
  taskDef?: TaskDef;
  
  /** Overwrite existing task definitions (default: true) */
  overwriteTaskDef?: boolean;
  
  /** Enforce strict JSON schema validation (default: false) */
  strictSchema?: boolean;
}

/**
 * Global worker registry for auto-discovery.
 * Workers registered via @worker decorator are stored here.
 */
class WorkerRegistry {
  private workers = new Map<string, RegisteredWorker>();

  /**
   * Register a worker in the global registry.
   * 
   * @param worker - Worker metadata to register
   */
  register(worker: RegisteredWorker): void {
    // Use taskDefName + domain as unique key
    const key = `${worker.taskDefName}:${worker.domain || ""}`;
    
    if (this.workers.has(key)) {
      console.warn(
        `Worker "${worker.taskDefName}" with domain "${worker.domain || "default"}" ` +
        `is already registered. Overwriting previous registration.`
      );
    }
    
    this.workers.set(key, worker);
  }

  /**
   * Get all registered workers.
   * 
   * @returns Array of registered workers
   */
  getAll(): RegisteredWorker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get a specific worker by task definition name and domain.
   * 
   * @param taskDefName - Task definition name
   * @param domain - Optional domain
   * @returns Registered worker or undefined
   */
  get(taskDefName: string, domain?: string): RegisteredWorker | undefined {
    const key = `${taskDefName}:${domain || ""}`;
    return this.workers.get(key);
  }

  /**
   * Clear all registered workers.
   * Useful for testing.
   */
  clear(): void {
    this.workers.clear();
  }

  /**
   * Get count of registered workers.
   */
  get size(): number {
    return this.workers.size;
  }
}

/**
 * Global singleton registry instance.
 */
export const workerRegistry = new WorkerRegistry();

/**
 * Register a worker in the global registry.
 * Used internally by the @worker decorator.
 * 
 * @param worker - Worker metadata to register
 */
export function registerWorker(worker: RegisteredWorker): void {
  workerRegistry.register(worker);
}

/**
 * Get all registered workers from the global registry.
 * Used by TaskHandler for auto-discovery.
 * 
 * @returns Array of all registered workers
 */
export function getRegisteredWorkers(): RegisteredWorker[] {
  return workerRegistry.getAll();
}

/**
 * Get a specific registered worker.
 * 
 * @param taskDefName - Task definition name
 * @param domain - Optional domain
 * @returns Registered worker or undefined
 */
export function getRegisteredWorker(
  taskDefName: string,
  domain?: string
): RegisteredWorker | undefined {
  return workerRegistry.get(taskDefName, domain);
}

/**
 * Clear all registered workers.
 * Primarily for testing purposes.
 */
export function clearWorkerRegistry(): void {
  workerRegistry.clear();
}

/**
 * Get the number of registered workers.
 */
export function getWorkerCount(): number {
  return workerRegistry.size;
}
