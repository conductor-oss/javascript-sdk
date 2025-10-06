# SchedulerClient API Reference

The `SchedulerClient` manages workflow scheduling and provides methods for creating, managing, and monitoring scheduled workflows.

## Constructor

### `new SchedulerClient(client: ConductorClient)`

Creates a new `SchedulerClient`.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `saveSchedule(param: SaveScheduleRequest): Promise<void>`

Creates or updates a schedule for a specified workflow.

**Parameters:**

-   `param` (`SaveScheduleRequest`): The request to save a schedule.

**Returns:**

-   `Promise<void>`

---

### `search(start: number, size: number, sort: string = "", freeText: string, query: string): Promise<SearchResultWorkflowScheduleExecutionModel>`

Searches for scheduler executions.

**Parameters:**

-   `start` (`number`): The starting offset.
-   `size` (`number`): The number of results to return.
-   `sort` (`string`, optional): The sort order.
-   `freeText` (`string`): The free text to search for.
-   `query` (`string`): The search query.

**Returns:**

-   `Promise<SearchResultWorkflowScheduleExecutionModel>`: The search results.

---

### `getSchedule(name: string): Promise<SaveScheduleRequest>`

Gets an existing schedule by name.

**Parameters:**

-   `name` (`string`): The name of the schedule.

**Returns:**

-   `Promise<SaveScheduleRequest>`: The schedule.

---

### `pauseSchedule(name: string): Promise<void>`

Pauses an existing schedule by name.

**Parameters:**

-   `name` (`string`): The name of the schedule.

**Returns:**

-   `Promise<void>`

---

### `resumeSchedule(name: string): Promise<void>`

Resumes a paused schedule by name.

**Parameters:**

-   `name` (`string`): The name of the schedule.

**Returns:**

-   `Promise<void>`

---

### `deleteSchedule(name: string): Promise<void>`

Deletes an existing schedule by name.

**Parameters:**

-   `name` (`string`): The name of the schedule.

**Returns:**

-   `Promise<void>`

---

### `getAllSchedules(workflowName?: string): Promise<Array<WorkflowSchedule>>`

Gets all existing workflow schedules, optionally filtering by workflow name.

**Parameters:**

-   `workflowName` (`string`, optional): The name of the workflow.

**Returns:**

-   `Promise<Array<WorkflowSchedule>>`: An array of workflow schedules.

---

### `getNextFewSchedules(cronExpression: string, scheduleStartTime?: number, scheduleEndTime?: number, limit: number = 3): Promise<Array<number[]>>`

Gets a list of the next execution times for a schedule.

**Parameters:**

-   `cronExpression` (`string`): The cron expression for the schedule.
-   `scheduleStartTime` (`number`, optional): The start time for the schedule.
-   `scheduleEndTime` (`number`, optional): The end time for the schedule.
-   `limit` (`number`, optional): The number of execution times to return. Defaults to 3.

**Returns:**

-   `Promise<Array<number[]>>`: An array of the next execution times.

---

### `pauseAllSchedules(): Promise<void>`

Pauses all scheduling in the Conductor server instance.

**Returns:**

-   `Promise<void>`

---

### `requeueAllExecutionRecords(): Promise<void>`

Requeues all execution records.

**Returns:**

-   `Promise<void>`

---

### `resumeAllSchedules(): Promise<void>`

Resumes all scheduling in the Conductor server instance.

**Returns:**

-   `Promise<void>`
