import { SignalResponse, Task, Workflow } from "../../../open-api";

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

export type TaskFinderPredicate = (task: Task) => boolean;


