import type { ConductorLogger } from "../../helpers/logger";
import type { ConductorWorker } from "./Worker";
import type { Task } from "../../../open-api";
import type { Client } from "../../../open-api/generated/client/types.gen";

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
