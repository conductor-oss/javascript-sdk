import type { SignalResponse, Task, TaskResult, Workflow } from "../open-api";
export class ConductorSdkError extends Error {
  private _trace;
  private __proto__: unknown;

  constructor(message?: string, innerError?: Error) {
    super(message);
    this.name = "[Conductor SDK Error]";
    this._trace = innerError;
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
  }
}
export type TaskResultStatus = NonNullable<TaskResult["status"]>;
export type TaskResultOutputData = NonNullable<TaskResult["outputData"]>;

export interface EnhancedSignalResponse extends SignalResponse {
  isTargetWorkflow(): boolean;
  isBlockingWorkflow(): boolean;
  isBlockingTask(): boolean;
  isBlockingTaskInput(): boolean;
  getWorkflow(): Workflow;
  getBlockingTask(): Task;
  getTaskInput(): Record<string, unknown>;
  getWorkflowId(): string;
  getTargetWorkflowId(): string;
  hasWorkflowData(): boolean;
  hasTaskData(): boolean;
  getResponseType(): string;
  isTerminal(): boolean;
  isRunning(): boolean;
  isPaused(): boolean;
  getSummary(): string;
  toDebugJSON(): Record<string, unknown>;
  toString(): string;
}

export interface OrkesApiConfig {
  serverUrl?: string;
  keyId?: string;
  keySecret?: string;
  refreshTokenInterval?: number;
  useEnvVars?: boolean; // DEPRECATED, has no effect
  maxHttp2Connections?: number; // max number of simultaneous http connections to the conductor server, defaults to 1 (since we use http2)
}
