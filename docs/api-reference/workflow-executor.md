# WorkflowExecutor API Reference

The `WorkflowExecutor` class is your main interface for managing workflows. It provides methods to register, start, monitor, and control workflow execution.

## Constructor

### `new WorkflowExecutor(client: ConductorClient)`

Creates a new WorkflowExecutor.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `registerWorkflow(override: boolean, workflow: WorkflowDef): Promise<void>`

Registers a workflow definition.

**Parameters:**

-   `override` (`boolean`): Whether to override the existing workflow definition.
-   `workflow` (`WorkflowDef`): The workflow definition.

**Returns:**

-   `Promise<void>`

---

### `startWorkflow(workflowRequest: StartWorkflowRequest): Promise<string>`

Starts a new workflow execution.

**Parameters:**

-   `workflowRequest` (`StartWorkflowRequest`): The request to start a workflow.

**Returns:**

-   `Promise<string>`: The ID of the workflow instance.

---

### `executeWorkflow(workflowRequest: StartWorkflowRequest, name: string, version: number, requestId: string, waitUntilTaskRef?: string): Promise<WorkflowRun>`
### `executeWorkflow(workflowRequest: StartWorkflowRequest, name: string, version: number, requestId: string, waitUntilTaskRef: string, waitForSeconds: number, consistency: Consistency, returnStrategy: ReturnStrategy): Promise<SignalResponse>`

Executes a workflow synchronously and waits for completion. Can return different responses based on the provided parameters.

**Parameters:**

-   `workflowRequest` (`StartWorkflowRequest`): The request to start a workflow.
-   `name` (`string`): The name of the workflow.
-   `version` (`number`): The version of the workflow.
-   `requestId` (`string`): A unique ID for the request.
-   `waitUntilTaskRef` (`string`, optional): The reference name of the task to wait for.
-   `waitForSeconds` (`number`, optional): The number of seconds to wait for the task.
-   `consistency` (`Consistency`, optional): The consistency level for the read operations.
-   `returnStrategy` (`ReturnStrategy`, optional): The strategy for what data to return.

**Returns:**

-   `Promise<WorkflowRun | SignalResponse>`: A `WorkflowRun` object or a `SignalResponse` object.

---

### `startWorkflows(workflowsRequest: StartWorkflowRequest[]): Promise<string>[]`

Starts multiple workflows at once.

**Parameters:**

-   `workflowsRequest` (`StartWorkflowRequest[]`): An array of workflow start requests.

**Returns:**

-   `Promise<string>[]`: An array of promises that resolve to the workflow instance IDs.

---

### `goBackToTask(workflowInstanceId: string, taskFinderPredicate: TaskFinderPredicate, rerunWorkflowRequestOverrides: Partial<RerunWorkflowRequest> = {}): Promise<void>`

Reruns a workflow from a specific task.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `taskFinderPredicate` (`TaskFinderPredicate`): A function to find the task to rerun from.
-   `rerunWorkflowRequestOverrides` (`Partial<RerunWorkflowRequest>`, optional): Overrides for the rerun request.

**Returns:**

-   `Promise<void>`

---

### `goBackToFirstTaskMatchingType(workflowInstanceId: string, taskType: string): Promise<void>`

Reruns a workflow from the first task of a specific type.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `taskType` (`string`): The type of the task to rerun from.

**Returns:**

-   `Promise<void>`

---

### `getWorkflow(workflowInstanceId: string, includeTasks: boolean, retry: number = 0): Promise<Workflow>`

Gets the execution status of a workflow.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `includeTasks` (`boolean`): Whether to include the tasks in the response.
-   `retry` (`number`, optional): The number of times to retry on failure.

**Returns:**

-   `Promise<Workflow>`: The workflow execution status.

---

### `getWorkflowStatus(workflowInstanceId: string, includeOutput: boolean, includeVariables: boolean): Promise<WorkflowStatus>`

Gets a summary of the current workflow status.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `includeOutput` (`boolean`): Whether to include the output in the response.
-   `includeVariables` (`boolean`): Whether to include the variables in the response.

**Returns:**

-   `Promise<WorkflowStatus>`: The workflow status summary.

---

### `getExecution(workflowInstanceId: string, includeTasks: boolean = true): Promise<Workflow>`

Gets the execution status of a workflow, including tasks by default.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `includeTasks` (`boolean`, optional): Whether to include the tasks in the response. Defaults to `true`.

**Returns:**

-   `Promise<Workflow>`: The workflow execution status.

---

### `pause(workflowInstanceId: string): Promise<void>`

Pauses a running workflow.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.

**Returns:**

-   `Promise<void>`

---

### `reRun(workflowInstanceId: string, rerunWorkflowRequest: Partial<RerunWorkflowRequest> = {}): Promise<string>`

Reruns a workflow with new parameters.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `rerunWorkflowRequest` (`Partial<RerunWorkflowRequest>`, optional): Overrides for the rerun request.

**Returns:**

-   `Promise<string>`: The ID of the new workflow instance.

---

### `restart(workflowInstanceId: string, useLatestDefinitions: boolean): Promise<void>`

Restarts a workflow.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `useLatestDefinitions` (`boolean`): Whether to use the latest workflow definition.

**Returns:**

-   `Promise<void>`

---

### `resume(workflowInstanceId: string): Promise<void>`

Resumes a paused workflow.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.

**Returns:**

-   `Promise<void>`

---

### `retry(workflowInstanceId: string, resumeSubworkflowTasks: boolean): Promise<void>`

Retries a workflow from the last failing task.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `resumeSubworkflowTasks` (`boolean`): Whether to resume tasks in sub-workflows.

**Returns:**

-   `Promise<void>`

---

### `search(start: number, size: number, query: string, freeText: string, sort: string = "", skipCache: boolean = false): Promise<ScrollableSearchResultWorkflowSummary>`

Searches for workflows.

**Parameters:**

-   `start` (`number`): The starting offset.
-   `size` (`number`): The number of results to return.
-   `query` (`string`): The search query.
-   `freeText` (`string`): The free text to search for.
-   `sort` (`string`, optional): The sort order.
-   `skipCache` (`boolean`, optional): Whether to skip the cache.

**Returns:**

-   `Promise<ScrollableSearchResultWorkflowSummary>`: The search results.

---

### `skipTasksFromWorkflow(workflowInstanceId: string, taskReferenceName: string, skipTaskRequest: Partial<SkipTaskRequest>): Promise<void>`

Skips a task in a running workflow.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `taskReferenceName` (`string`): The reference name of the task to skip.
-   `skipTaskRequest` (`Partial<SkipTaskRequest>`): The request to skip the task.

**Returns:**

-   `Promise<void>`

---

### `terminate(workflowInstanceId: string, reason: string): Promise<void>`

Terminates a running workflow.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `reason` (`string`): The reason for termination.

**Returns:**

-   `Promise<void>`

---

### `updateTask(taskId: string, workflowInstanceId: string, taskStatus: TaskResultStatus, outputData: Record<string, any>): Promise<string>`

Updates a task by its ID.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `taskStatus` (`TaskResultStatus`): The new status of the task.
-   `outputData` (`Record<string, any>`): The output data of the task.

**Returns:**

-   `Promise<string>`

---

### `updateTaskByRefName(taskReferenceName: string, workflowInstanceId: string, status: TaskResultStatus, taskOutput: Record<string, any>): Promise<string>`

Updates a task by its reference name.

**Parameters:**

-   `taskReferenceName` (`string`): The reference name of the task.
-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `status` (`TaskResultStatus`): The new status of the task.
-   `taskOutput` (`Record<string, any>`): The output data of the task.

**Returns:**

-   `Promise<string>`

---

### `getTask(taskId: string): Promise<Task>`

Gets a task by its ID.

**Parameters:**

-   `taskId` (`string`): The ID of the task.

**Returns:**

-   `Promise<Task>`: The task.

---

### `updateTaskSync(taskReferenceName: string, workflowInstanceId: string, status: TaskResultStatusEnum, taskOutput: Record<string, any>, workerId?: string): Promise<Workflow>`

Updates a task by its reference name synchronously and returns the complete workflow.

**Parameters:**

-   `taskReferenceName` (`string`): The reference name of the task.
-   `workflowInstanceId` (`string`): The ID of the workflow instance.
-   `status` (`TaskResultStatusEnum`): The new status of the task.
-   `taskOutput` (`Record<string, any>`): The output data of the task.
-   `workerId` (`string`, optional): The ID of the worker.

**Returns:**

-   `Promise<Workflow>`: The updated workflow.

---

### `signal(workflowInstanceId: string, status: TaskResultStatusEnum, taskOutput: Record<string, any>, returnStrategy: ReturnStrategy = ReturnStrategy.TARGET_WORKFLOW): Promise<SignalResponse>`

Signals a workflow task and returns data based on the specified return strategy.

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance to signal.
-   `status` (`TaskResultStatusEnum`): The task status to set.
-   `taskOutput` (`Record<string, any>`): The output data for the task.
-   `returnStrategy` (`ReturnStrategy`, optional): The strategy for what data to return. Defaults to `TARGET_WORKFLOW`.

**Returns:**

-   `Promise<SignalResponse>`: The response from the signal.

---

### `signalAsync(workflowInstanceId: string, status: TaskResultStatusEnum, taskOutput: Record<string, any>): Promise<void>`

Signals a workflow task asynchronously (fire-and-forget).

**Parameters:**

-   `workflowInstanceId` (`string`): The ID of the workflow instance to signal.
-   `status` (`TaskResultStatusEnum`): The task status to set.
-   `taskOutput` (`Record<string, any>`): The output data for the task.

**Returns:**

-   `Promise<void>`

---

## Type Definitions

### `WorkflowDef`
| Property | Type | Description |
| --- | --- | --- |
| `ownerApp` | `string` | The owner app of the workflow. |
| `createTime` | `number` | The creation time of the workflow. |
| `updateTime` | `number` | The last update time of the workflow. |
| `createdBy` | `string` | The user who created the workflow. |
| `updatedBy` | `string` | The user who last updated the workflow. |
| `name` | `string` | The name of the workflow. |
| `description` | `string` | The description of the workflow. |
| `version` | `number` | The version of the workflow. |
| `tasks` | `WorkflowTask[]` | The tasks in the workflow. |
| `inputParameters` | `string[]` | The input parameters of the workflow. |
| `outputParameters` | `Record<string, any>` | The output parameters of the workflow. |
| `failureWorkflow` | `string` | The failure workflow. |
| `schemaVersion` | `number` | The schema version of the workflow. |
| `restartable` | `boolean` | Whether the workflow is restartable. |
| `workflowStatusListenerEnabled` | `boolean` | Whether the workflow status listener is enabled. |
| `ownerEmail` | `string` | The owner email of the workflow. |
| `timeoutPolicy` | `'TIME_OUT_WF' \| 'ALERT_ONLY'` | The timeout policy of the workflow. |
| `timeoutSeconds` | `number` | The timeout in seconds of the workflow. |
| `variables` | `Record<string, any>` | The variables of the workflow. |
| `inputTemplate` | `Record<string, any>` | The input template of the workflow. |

### `WorkflowTask`
| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the task. |
| `taskReferenceName` | `string` | The reference name of the task. |
| `description` | `string` | The description of the task. |
| `inputParameters` | `Record<string, any>` | The input parameters of the task. |
| `type` | `string` | The type of the task. |
| `dynamicTaskNameParam` | `string` | The dynamic task name parameter. |
| `caseValueParam` | `string` | The case value parameter. |
| `caseExpression` | `string` | The case expression. |
| `scriptExpression` | `string` | The script expression. |
| `decisionCases` | `Record<string, Array<WorkflowTask>>` | The decision cases. |
| `dynamicForkJoinTasksParam`| `string` | The dynamic fork join tasks parameter. |
| `dynamicForkTasksParam` | `string` | The dynamic fork tasks parameter. |
| `dynamicForkTasksInputParamName` | `string` | The dynamic fork tasks input parameter name. |
| `defaultCase` | `WorkflowTask[]` | The default case. |
| `forkTasks` | `WorkflowTask[][]` | The fork tasks. |
| `startDelay` | `number` | The start delay in seconds. |
| `subWorkflowParam` | `SubWorkflowParams` | The sub-workflow parameters. |
| `joinOn` | `string[]` | The join on tasks. |
| `sink` | `string` | The sink. |
| `optional` | `boolean` | Whether the task is optional. |
| `taskDefinition` | `TaskDef` | The task definition. |
| `rateLimited` | `boolean` | Whether the task is rate limited. |
| `defaultExclusiveJoinTask` | `string[]` | The default exclusive join task. |
| `asyncComplete` | `boolean` | Whether the task is async complete. |
| `loopCondition` | `string` | The loop condition. |
| `loopOver` | `WorkflowTask[]` | The loop over tasks. |
| `retryCount` | `number` | The retry count. |
| `evaluatorType` | `string` | The evaluator type. |
| `expression` | `string` | The expression. |
| `workflowTaskType` | `'SIMPLE' \| 'DYNAMIC' \| 'FORK_JOIN' \| 'FORK_JOIN_DYNAMIC' \| 'DECISION' \| 'SWITCH' \| 'JOIN' \| 'DO_WHILE' \| 'SUB_WORKFLOW' \| 'START_WORKFLOW' \| 'EVENT' \| 'WAIT' \| 'HUMAN' \| 'USER_DEFINED' \| 'HTTP' \| 'LAMBDA' \| 'INLINE' \| 'EXCLUSIVE_JOIN' \| 'TERMINATE' \| 'KAFKA_PUBLISH' \| 'JSON_JQ_TRANSFORM' \| 'SET_VARIABLE'` | The type of the workflow task. |

### `WorkflowRun`
| Property | Type | Description |
| --- | --- | --- |
| `correlationId` | `string` | The correlation ID of the workflow. |
| `createTime` | `number` | The creation time of the workflow. |
| `createdBy` | `string` | The user who created the workflow. |
| `priority` | `number` | The priority of the workflow. |
| `requestId` | `string` | The request ID of the workflow. |
| `status` | `string` | The status of the workflow. |
| `tasks` | `Task[]` | The tasks in the workflow. |
| `updateTime` | `number` | The last update time of the workflow. |
| `workflowId` | `string` | The ID of the workflow instance. |
| `variables` | `Record<string, object>` | The variables of the workflow. |
| `input` | `Record<string, object>` | The input data for the workflow. |
| `output` | `Record<string, object>` | The output data for the workflow. |

### `SignalResponse`
`SignalResponse` represents a unified response from the signal API. It contains different fields depending on the `returnStrategy` used. It also has helper methods to extract the workflow or task details from the response.

### `TaskFinderPredicate`
`TaskFinderPredicate` is a function that takes a `Task` and returns a boolean. It is used to find a specific task in a workflow.
` (task: Task) => boolean`

### `RerunWorkflowRequest`
| Property | Type | Description |
| --- | --- | --- |
| `reRunFromWorkflowId` | `string` | The ID of the workflow to rerun from. |
| `workflowInput` | `Record<string, any>` | The input data for the workflow. |
| `reRunFromTaskId` | `string` | The ID of the task to rerun from. |
| `taskInput` | `Record<string, any>` | The input data for the task. |
| `correlationId` | `string` | The correlation ID of the workflow. |

### `Workflow`
| Property | Type | Description |
| --- | --- | --- |
| `ownerApp` | `string` | The owner app of the workflow. |
| `createTime` | `number` | The creation time of the workflow. |
| `updateTime` | `number` | The last update time of the workflow. |
| `createdBy` | `string` | The user who created the workflow. |
| `updatedBy` | `string` | The user who last updated the workflow. |
| `status` | `'RUNNING' \| 'COMPLETED' \| 'FAILED' \| 'TIMED_OUT' \| 'TERMINATED' \| 'PAUSED'` | The status of the workflow. |
| `idempotencyKey` | `string` | The idempotency key for the workflow. |
| `endTime` | `number` | The end time of the workflow. |
| `workflowId` | `string` | The ID of the workflow instance. |
| `parentWorkflowId` | `string` | The ID of the parent workflow instance. |
| `parentWorkflowTaskId` | `string` | The ID of the parent workflow task. |
| `tasks` | `Task[]` | The tasks in the workflow. |
| `input` | `Record<string, any>` | The input data for the workflow. |
| `output` | `Record<string, any>` | The output data for the workflow. |
| `correlationId` | `string` | The correlation ID of the workflow. |
| `reRunFromWorkflowId` | `string` | The ID of the workflow to rerun from. |
| `reasonForIncompletion` | `string` | The reason for incompletion. |
| `event` | `string` | The event that triggered the workflow. |
| `taskToDomain` | `Record<string, string>` | A map of task reference names to domains. |
| `failedReferenceTaskNames` | `string[]` | A list of failed task reference names. |
| `workflowDefinition` | `WorkflowDef` | The workflow definition. |
| `externalInputPayloadStoragePath`| `string` | The path to the external input payload storage. |
| `externalOutputPayloadStoragePath`| `string` | The path to the external output payload storage. |
| `priority` | `number` | The priority of the workflow. |
| `variables` | `Record<string, any>` | The variables of the workflow. |
| `lastRetriedTime` | `number` | The last time the workflow was retried. |
| `startTime` | `number` | The start time of the workflow. |
| `workflowVersion` | `number` | The version of the workflow. |
| `workflowName` | `string` | The name of the workflow. |

### `WorkflowStatus`
| Property | Type | Description |
| --- | --- | --- |
| `workflowId` | `string` | The ID of the workflow instance. |
| `correlationId` | `string` | The correlation ID of the workflow. |
| `output` | `Record<string, any>` | The output data for the workflow. |
| `variables` | `Record<string, any>` | The variables of the workflow. |
| `status` | `'RUNNING' \| 'COMPLETED' \| 'FAILED' \| 'TIMED_OUT' \| 'TERMINATED' \| 'PAUSED'` | The status of the workflow. |

### `ScrollableSearchResultWorkflowSummary`
| Property | Type | Description |
| --- | --- | --- |
| `results` | `WorkflowSummary[]` | The search results. |
| `totalHits` | `number` | The total number of hits. |

### `SkipTaskRequest`
| Property | Type | Description |
| --- | --- | --- |
| `taskInput` | `Record<string, any>` | The input data for the task. |
| `taskOutput` | `Record<string, any>` | The output data for the task. |

### `TaskResultStatus`
`TaskResultStatus` is a string that represents the status of a task result. It can be one of the following values: `'IN_PROGRESS'`, `'FAILED'`, `'FAILED_WITH_TERMINAL_ERROR'`, `'COMPLETED'`.

### `Task`
| Property | Type | Description |
| --- | --- | --- |
| `taskType` | `string` | The type of the task. |
| `status` | `'IN_PROGRESS' \| 'CANCELED' \| 'FAILED' \| 'FAILED_WITH_TERMINAL_ERROR' \| 'COMPLETED' \| 'COMPLETED_WITH_ERRORS' \| 'SCHEDULED' \| 'TIMED_OUT' \| 'SKIPPED'` | The status of the task. |
| `inputData` | `Record<string, any>` | The input data for the task. |
| `referenceTaskName` | `string` | The reference name of the task. |
| `retryCount` | `number` | The retry count. |
| `seq` | `number` | The sequence number of the task. |
| `correlationId` | `string` | The correlation ID of the task. |
| `pollCount` | `number` | The poll count. |
| `taskDefName` | `string` | The name of the task definition. |
| `scheduledTime` | `number` | The scheduled time of the task. |
| `startTime` | `number` | The start time of the task. |
| `endTime` | `number` | The end time of the task. |
| `updateTime` | `number` | The last update time of the task. |
| `startDelayInSeconds` | `number` | The start delay in seconds. |
| `retriedTaskId` | `string` | The ID of the retried task. |
| `retried` | `boolean` | Whether the task was retried. |
| `executed` | `boolean` | Whether the task was executed. |
| `callbackFromWorker` | `boolean` | Whether the callback is from a worker. |
| `responseTimeoutSeconds` | `number` | The response timeout in seconds. |
| `workflowInstanceId` | `string` | The ID of the workflow instance. |
| `workflowType` | `string` | The type of the workflow. |
| `taskId` | `string` | The ID of the task. |
| `reasonForIncompletion` | `string` | The reason for incompletion. |
| `callbackAfterSeconds` | `number` | The callback after seconds. |
| `workerId` | `string` | The ID of the worker. |
| `outputData` | `Record<string, any>` | The output data of the task. |
| `workflowTask` | `WorkflowTask` | The workflow task. |
| `domain` | `string` | The domain of the task. |
| `rateLimitPerFrequency` | `number` | The rate limit per frequency. |
| `rateLimitFrequencyInSeconds` | `number` | The rate limit frequency in seconds. |
| `externalInputPayloadStoragePath`| `string` | The path to the external input payload storage. |
| `externalOutputPayloadStoragePath`| `string` | The path to the external output payload storage. |
| `workflowPriority` | `number` | The priority of the workflow. |
| `executionNameSpace` | `string` | The execution namespace. |
| `isolationGroupId` | `string` | The isolation group ID. |
| `iteration` | `number` | The iteration number. |
| `subWorkflowId` | `string` | The ID of the sub-workflow. |
| `subworkflowChanged` | `boolean` | Whether the sub-workflow was changed. |
| `queueWaitTime` | `number` | The queue wait time. |
| `taskDefinition` | `TaskDef` | The task definition. |
| `loopOverTask` | `boolean` | Whether the task is a loop over task. |
