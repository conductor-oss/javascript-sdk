# Searching for Entities and Executions

The Conductor API provides a search endpoint to search for entities in Conductor. The search endpoint supports searching for workflows, tasks, and more.

Use the search API to retrieve information about entities and executions in Conductor.

## Search for Workflow Executions

```typescript
import { orkesConductorClient, WorkflowExecutor } from "@io-orkes/conductor-javascript";

async function searchExecution(
  start = 0,
  size = 15,
  query = "startTime>1719842897739",
  freeText = "",
  sort = "startTime:DESC"
) {
  const client = await orkesConductorClient({
    TOKEN: "yourToken",
    serverUrl: "http://yourServer.url/api"
  });
  const executor = new WorkflowExecutor(client);
  const results = await executor.search(start, size, query, freeText, sort );

  return results;
  }

  searchExecution();
```

## Search for Task Executions

```typescript
import { orkesConductorClient, TaskClient } from "@io-orkes/conductor-javascript";

async function searchTask(
  start = 0,
  size = 15,
  sort = "startTime:DESC",
  freeText = "",
  query = "startTime>1719843016751",
) {
  const client = await orkesConductorClient({
    TOKEN: "yourToken",
    serverUrl: "http://yourServer.url/api"
  });
  const taskClient = new TaskClient(client);
  const results = await taskClient.search(start, size, sort, freeText, query);

  return results;
}

const doSearch = async () => {
  const tasks = await searchTask();
  console.log(tasks);
}

doSearch();
```

## Search for Human Tasks Executions

```typescript
import {
    orkesConductorClient,
    HumanExecutor
  } from "@io-orkes/conductor-javascript";

  const clientPromise = orkesConductorClient({
    TOKEN: "yourToken",
    serverUrl: "http://yourServer.url/api"
  });

  const searchHumanTask = async () => {
    const client = await clientPromise;
    const executor = new HumanExecutor(client);

    const tasks = await executor.search({
      start: 1,
      size: 15,
      claimants: [{"userType":"CONDUCTOR_USER","user":"test"}],
      assignees: [{"userType":"CONDUCTOR_USER","user":"test123"}],
      states: ["IN_PROGRESS","ASSIGNED"],
      taskInputQuery: "",
      taskOutputQuery: "",
      taskRefNames: ["ref1","ref2"],
      definitionNames: ["name1","name2"],
    });

    return tasks;
  }

  searchHumanTask();
```

## Search for Scheduler Executions

```typescript
import { orkesConductorClient, SchedulerClient } from "@io-orkes/conductor-javascript";

async function searchSchedule(
  start = 0,
  size = 15,
  sort = "startTime:DESC",
  freeText = "*",
  query = "",
) {
  const client = await orkesConductorClient({
    TOKEN: "yourToken",
    serverUrl: "http://yourServer.url/api"
  });
  const executor = new SchedulerClient(client);
  const results = await executor.search(start, size, sort, freeText, query);

  return results;
}

searchSchedule();
```

### More Docs

* [Getting Started](getting-started.md)
* [Create and run task workers](workers.md)
* [Create Workflows](create.md)
* [Execute Workflows](execute.md)
* [About](about.md)

