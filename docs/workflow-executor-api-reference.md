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
