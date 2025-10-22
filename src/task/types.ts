import type { ConductorLogger } from "../common";
import type { ConductorWorker } from "./Worker";
import type { Task } from "../common";
import { Client } from "../common/open-api/client/types.gen";

export type TaskErrorHandler = (error: Error, task?: Task) => void;
export interface TaskRunnerOptions {
  workerID: string;
  domain: string | undefined;
  pollInterval?: number;
  concurrency?: number;
  batchPollingTimeout?: number;
}
export interface RunnerArgs {
  worker: ConductorWorker;
  client: Client;
  options: TaskRunnerOptions;
  logger?: ConductorLogger;
  onError?: TaskErrorHandler;
  concurrency?: number;
  maxRetries?: number;
}
