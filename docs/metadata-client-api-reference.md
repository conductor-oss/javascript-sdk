# MetadataClient API Reference

The `MetadataClient` class provides methods for managing task and workflow definitions in Conductor.

## Constructor

### `new MetadataClient(client: ConductorClient)`

Creates a new `MetadataClient`.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `unregisterTask(name: string): Promise<void>`

Unregisters an existing task definition by name.

**Parameters:**

-   `name` (`string`): The name of the task definition.

**Returns:**

-   `Promise<void>`

---

### `registerTask(taskDef: TaskDef): Promise<void>`

Registers a new task definition.

**Parameters:**

-   `taskDef` (`TaskDef`): The task definition to register.

**Returns:**

-   `Promise<void>`

---

### `updateTask(taskDef: TaskDef): Promise<void>`

Updates an existing task definition.

**Parameters:**

-   `taskDef` (`TaskDef`): The task definition to update.

**Returns:**

-   `Promise<void>`

---

### `registerWorkflowDef(workflowDef: WorkflowDef, overwrite: boolean = false): Promise<void>`

Creates or updates a workflow definition.

**Parameters:**

-   `workflowDef` (`WorkflowDef`): The workflow definition to register.
-   `overwrite` (`boolean`, optional): Whether to overwrite an existing workflow definition. Defaults to `false`.

**Returns:**

-   `Promise<void>`

---

### `unregisterWorkflow(workflowName: string, version: number = 1): Promise<void>`

Unregisters a workflow definition.

**Parameters:**

-   `workflowName` (`string`): The name of the workflow to unregister.
-   `version` (`number`, optional): The version of the workflow to unregister. Defaults to `1`.

**Returns:**

-   `Promise<void>`

