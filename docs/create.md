# Authoring Workflows with the Javascript SDK

## A simple two-step workflow

```typescript
import {
  OrkesApiConfig,
  orkesConductorClient,
  TaskRunner,
  simpleTask,
} from "@io-orkes/conductor-javascript";

//API client instance with server address and authentication details
const clientPromise = orkesConductorClient({
  keyId: "XXX", // optional
  keySecret: "XXXX", // optional
  serverUrl: "https://play.orkes.io/api",
});

const client = await clientPromise;

//Create new workflow executor
const executor = new WorkflowExecutor(client);

// Using Factory function
const factoryWf = {
  name: "my_first_workflow",
  version: 1,
  ownerEmail: "developers@orkes.io",
  tasks: [simpleTask("simple_task_ref", "simple_task", {})],
  inputParameters: [],
  outputParameters: {},
  timeoutSeconds: 0,
};
const workflow = executor.registerWorkflow(true, factoryWf);
```

## Using Workflow Executor to start previously registered workflow

```typescript
const executor = new WorkflowExecutor(client);
const executionId = await executor.startWorkflow({ name, version, input: {} });
```

See [execute](docs/execute.md) page to learn more about how to execute Workflows.

### More Docs

* [Getting Started](getting-started.md)
* [Create and run task workers](workers.md)
* [Execute Workflows](execute.md)
* [Search for entities](search.md)
* [About](about.md)

