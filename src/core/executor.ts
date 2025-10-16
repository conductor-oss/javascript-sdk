import {
  Consistency,
  ReturnStrategy,
  TaskResultStatusEnum,
  WorkflowDef,
} from "../common";
import {
  MetadataResource,
  RerunWorkflowRequest,
  ScrollableSearchResultWorkflowSummary,
  SkipTaskRequest,
  StartWorkflowRequest,
  Task,
  TaskResource,
  Workflow,
  WorkflowResource,
  WorkflowRun,
  WorkflowStatus,
} from "../common/open-api";
import {
  EnhancedSignalResponse,
  TaskResultOutputData,
  TaskResultStatus,
} from "./types";
import { errorMapper, reverseFind, tryCatchReThrow } from "./helpers";
import { Client } from "../common/open-api/client/types.gen";
import { enhanceSignalResponse } from "./helpers/enchanceSignalResponse";

const RETRY_TIME_IN_MILLISECONDS = 10000;

export type TaskFinderPredicate = (task: Task) => boolean;

export const completedTaskMatchingType =
  (taskType: string): TaskFinderPredicate =>
  (task: Task) =>
    task.status === "COMPLETED" && task.taskType === taskType;

export class WorkflowExecutor {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Will persist a workflow in conductor
   * @param override If true will override the existing workflow with the definition
   * @param workflow Complete workflow definition
   * @returns null
   */

  public registerWorkflow(
    override: boolean,
    workflow: WorkflowDef
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      await MetadataResource.create({
        body: workflow,
        query: {
          overwrite: override,
        },
        client: this._client,
      });
    });
  }

  /**
   * Takes a StartWorkflowRequest. returns a Promise<string> with the workflowInstanceId of the running workflow
   * @param workflowRequest
   * @returns
   */
  public startWorkflow(
    workflowRequest: StartWorkflowRequest
  ): Promise<string | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await WorkflowResource.startWorkflow({
        body: workflowRequest,
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Execute a workflow synchronously (original method - backward compatible)
   */
  public executeWorkflow(
    workflowRequest: StartWorkflowRequest,
    name: string,
    version: number,
    requestId: string,
    waitUntilTaskRef?: string
  ): Promise<WorkflowRun>;

  /**
   * Execute a workflow with return strategy support (new method)
   */
  public executeWorkflow(
    workflowRequest: StartWorkflowRequest,
    name: string,
    version: number,
    requestId: string,
    waitUntilTaskRef: string,
    waitForSeconds: number,
    consistency: Consistency,
    returnStrategy: ReturnStrategy
  ): Promise<EnhancedSignalResponse>;

  // Implementation
  public executeWorkflow(
    workflowRequest: StartWorkflowRequest,
    name: string,
    version: number,
    requestId: string,
    waitUntilTaskRef = "",
    waitForSeconds?: number,
    consistency?: Consistency,
    returnStrategy?: ReturnStrategy
  ): Promise<WorkflowRun | EnhancedSignalResponse | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await WorkflowResource.executeWorkflow({
        body: workflowRequest,
        path: {
          name,
          version,
        },
        query: {
          requestId,
          waitUntilTaskRef,
          waitForSeconds,
          consistency,
          returnStrategy,
        },
        client: this._client,
      });

      return data ? enhanceSignalResponse(data) : undefined;
    });
  }

  public startWorkflows(
    workflowsRequest: StartWorkflowRequest[]
  ): Promise<string | undefined>[] {
    return workflowsRequest.map((req) => this.startWorkflow(req));
  }

  public async goBackToTask(
    workflowInstanceId: string,
    taskFinderPredicate: TaskFinderPredicate,
    rerunWorkflowRequestOverrides: Partial<RerunWorkflowRequest> = {}
  ): Promise<void> {
    const executedTasks =
      (await this.getExecution(workflowInstanceId))?.tasks ?? [];
    const maybePreviousTask = reverseFind<Task>(
      executedTasks,
      taskFinderPredicate
    );

    if (!maybePreviousTask) {
      throw new Error("Task not found");
    }

    await this.reRun(workflowInstanceId, {
      //taskInput: previousTask.inputData,
      ...rerunWorkflowRequestOverrides,
      reRunFromTaskId: maybePreviousTask.taskId,
    });
  }

  public async goBackToFirstTaskMatchingType(
    workflowInstanceId: string,
    taskType: string
  ): Promise<void> {
    return this.goBackToTask(
      workflowInstanceId,
      completedTaskMatchingType(taskType)
    );
  }

  /**
   * Takes an workflowInstanceId and an includeTasks and an optional retry parameter returns the whole execution status.
   * If includeTasks flag is provided. Details of tasks execution will be returned as well,
   * retry specifies the amount of retrys before throwing an error.
   *
   * @param workflowInstanceId
   * @param includeTasks
   * @param retry
   * @returns
   */
  public async getWorkflow(
    workflowInstanceId: string,
    includeTasks: boolean,
    retry = 0
  ): Promise<Workflow | undefined> {
    try {
      const { data: workflowStatus } =
        await WorkflowResource.getExecutionStatus({
          path: { workflowId: workflowInstanceId },
          query: { includeTasks },
          client: this._client,
        });

      return workflowStatus;
    } catch (error: unknown) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error.status as number)
          : undefined;
      const isRetryableError =
        status !== undefined && [500, 404, 403].includes(status);
      if (!isRetryableError || retry === 0) {
        throw errorMapper(error);
      }
    }

    await new Promise((res) =>
      setTimeout(() => res(true), RETRY_TIME_IN_MILLISECONDS)
    );

    return this.getWorkflow(workflowInstanceId, includeTasks, retry - 1);
  }

  /**
   *  Returns a summary of the current workflow status.
   *
   * @param workflowInstanceId current running workflow
   * @param includeOutput flag to include output
   * @param includeVariables flag to include variable
   * @returns Promise<WorkflowStatus>
   */
  public getWorkflowStatus(
    workflowInstanceId: string,
    includeOutput: boolean,
    includeVariables: boolean
  ): Promise<WorkflowStatus | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await WorkflowResource.getWorkflowStatusSummary({
        path: { workflowId: workflowInstanceId },
        query: { includeOutput, includeVariables },
        client: this._client,
      });
      return data;
    });
  }

  /**
   *  Returns a summary of the current workflow status.
   *
   * @param workflowInstanceId current running workflow
   * @param includeOutput flag to include output
   * @param includeVariables flag to include variable
   * @returns Promise<WorkflowStatus>
   */
  public getExecution(
    workflowInstanceId: string,
    includeTasks = true
  ): Promise<Workflow | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await WorkflowResource.getExecutionStatus({
        path: { workflowId: workflowInstanceId },
        query: { includeTasks },
        client: this._client,
      });
      return data;
    });
  }

  /**
   * Pauses a running workflow
   * @param workflowInstanceId current workflow execution
   * @returns
   */
  public pause(workflowInstanceId: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await WorkflowResource.pauseWorkflow({
        path: { workflowId: workflowInstanceId },
        client: this._client,
      });
    });
  }

  /**
   * Reruns workflowInstanceId workflow. with new parameters
   *
   * @param workflowInstanceId current workflow execution
   * @param rerunWorkflowRequest Rerun Workflow Execution Request
   * @returns
   */
  public reRun(
    workflowInstanceId: string,
    rerunWorkflowRequest: Partial<RerunWorkflowRequest> = {}
  ): Promise<string | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await WorkflowResource.rerun({
        path: { workflowId: workflowInstanceId },
        body: rerunWorkflowRequest,
        client: this._client,
      });
      return data;
    });
  }

  /**
   * Restarts workflow with workflowInstanceId, if useLatestDefinition uses last defintion
   * @param workflowInstanceId
   * @param useLatestDefinitions
   * @returns
   */
  public restart(
    workflowInstanceId: string,
    useLatestDefinitions: boolean
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      const { data } = await WorkflowResource.restart({
        path: { workflowId: workflowInstanceId },
        query: { useLatestDefinitions },
        client: this._client,
      });
      return data;
    });
  }

  /**
   * Resumes a previously paused execution
   *
   * @param workflowInstanceId Running workflow workflowInstanceId
   * @returns
   */
  public resume(workflowInstanceId: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await WorkflowResource.resumeWorkflow({
        path: { workflowId: workflowInstanceId },
        client: this._client,
      });
    });
  }

  /**
   * Retrys workflow from last failing task
   * if resumeSubworkflowTasks is true will resume tasks in spawned subworkflows
   *
   * @param workflowInstanceId
   * @param resumeSubworkflowTasks
   * @returns
   */
  public retry(
    workflowInstanceId: string,
    resumeSubworkflowTasks: boolean
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      await WorkflowResource.retry({
        path: { workflowId: workflowInstanceId },
        query: { resumeSubworkflowTasks },
        client: this._client,
      });
    });
  }

  /**
   * Searches for existing workflows given the following querys
   *
   * @param start
   * @param size
   * @param query
   * @param freeText
   * @param sort
   * @param skipCache
   * @returns
   */
  public search(
    start: number,
    size: number,
    query: string,
    freeText: string,
    sort = "",
    skipCache = false
  ): Promise<ScrollableSearchResultWorkflowSummary | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await WorkflowResource.search1({
        query: { start, size, sort, freeText, query, skipCache },
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Skips a task of a running workflow.
   * by providing a skipTaskRequest you can set the input and the output of the skipped tasks
   * @param workflowInstanceId
   * @param taskReferenceName
   * @param skipTaskRequest
   * @returns
   */
  public skipTasksFromWorkflow(
    workflowInstanceId: string,
    taskReferenceName: string,
    skipTaskRequest: Partial<SkipTaskRequest>
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      await WorkflowResource.skipTaskFromWorkflow({
        path: { workflowId: workflowInstanceId, taskReferenceName },
        body: skipTaskRequest,
        client: this._client,
      });
    });
  }

  /**
   * Takes an workflowInstanceId, and terminates a running workflow
   * @param workflowInstanceId
   * @param reason
   * @returns
   */
  public terminate(workflowInstanceId: string, reason: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await WorkflowResource.terminate1({
        path: { workflowId: workflowInstanceId },
        query: { reason },
        client: this._client,
      });
    });
  }

  /**
   * Takes a taskId and a workflowInstanceId. Will update the task for the corresponding taskId
   * @param taskId
   * @param workflowInstanceId
   * @param taskStatus
   * @param taskOutput
   * @returns
   */
  public updateTask(
    taskId: string,
    workflowInstanceId: string,
    taskStatus: TaskResultStatus,
    outputData: TaskResultOutputData
  ): Promise<string | undefined> {
    const taskUpdates = { status: taskStatus, taskId, workflowInstanceId };
    return tryCatchReThrow(async () => {
      const { data } = await TaskResource.updateTask({
        body: { outputData, ...taskUpdates },
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Updates a task by reference Name
   * @param taskReferenceName
   * @param workflowInstanceId
   * @param status
   * @param taskOutput
   * @returns
   */
  public updateTaskByRefName(
    taskReferenceName: string,
    workflowInstanceId: string,
    status: TaskResultStatus,
    taskOutput: TaskResultOutputData
  ): Promise<string | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await TaskResource.updateTask1({
        path: {
          workflowId: workflowInstanceId,
          taskRefName: taskReferenceName,
          status,
        },
        body: taskOutput,
        client: this._client,
      });

      return data;
    });
  }

  /**
   *
   * @param taskId
   * @returns
   */
  public getTask(taskId: string): Promise<Task | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await TaskResource.getTask({
        path: { taskId },
        client: this._client,
      });
      return data;
    });
  }

  /**
   * Updates a task by reference name synchronously and returns the complete workflow
   * @param taskReferenceName
   * @param workflowInstanceId
   * @param status
   * @param taskOutput
   * @param workerId - Optional
   * @returns Promise<Workflow>
   */
  public updateTaskSync(
    taskReferenceName: string,
    workflowInstanceId: string,
    status: TaskResultStatusEnum,
    taskOutput: TaskResultOutputData,
    workerId?: string
  ): Promise<Workflow | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await TaskResource.updateTaskSync({
        path: {
          workflowId: workflowInstanceId,
          taskRefName: taskReferenceName,
          status,
        },
        body: { taskOutput },
        query: { workerid: workerId },
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Signals a workflow task and returns data based on the specified return strategy
   * @param workflowInstanceId - Workflow instance ID to signal
   * @param status - Task status to set
   * @param taskOutput - Output data for the task
   * @param returnStrategy - Optional strategy for what data to return (defaults to TARGET_WORKFLOW)
   * @returns Promise<SignalResponse> with data based on the return strategy
   */
  public signal(
    workflowInstanceId: string,
    status: TaskResultStatusEnum,
    taskOutput: TaskResultOutputData,
    returnStrategy: ReturnStrategy = ReturnStrategy.TARGET_WORKFLOW
  ): Promise<EnhancedSignalResponse | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await TaskResource.signalWorkflowTaskSync({
        path: { workflowId: workflowInstanceId, status },
        body: { taskOutput },
        query: { returnStrategy },
        client: this._client,
      });

      return data ? enhanceSignalResponse(data) : undefined;
    });
  }

  /**
   * Signals a workflow task asynchronously (fire-and-forget)
   * @param workflowInstanceId - Workflow instance ID to signal
   * @param status - Task status to set
   * @param taskOutput - Output data for the task
   * @returns Promise<void>
   */
  public signalAsync(
    workflowInstanceId: string,
    status: TaskResultStatusEnum,
    taskOutput: TaskResultOutputData
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      await TaskResource.signalWorkflowTaskASync({
        path: { workflowId: workflowInstanceId, status },
        body: { taskOutput },
        client: this._client,
      });
    });
  }
}
