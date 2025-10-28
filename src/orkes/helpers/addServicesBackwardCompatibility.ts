import { Client } from "../../common/open-api/client/types.gen";
import {
  EventResource,
  HumanTaskResource,
  UserFormTemplateResource,
  MetadataResource,
  ServiceRegistryResource,
  SchedulerResource,
  TaskResource,
  TokenResource,
  WorkflowResource,
  WorkflowBulkResource,
  HealthCheckResource,
} from "../../common/open-api/sdk.gen";

export const addServicesBackwardCompatibility = (client: Client) => {
  (client as any).eventResource = {
    getQueueConfig: (queueType: string, queueName: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return EventResource.getQueueConfig({
        client,
        path: { queueType, queueName },
        throwOnError: true,
      });
    },

    putQueueConfig: (queueType: string, queueName: string, body: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      EventResource.putQueueConfig({
        client,
        path: { queueType, queueName },
        body,
        throwOnError: true,
      });
    },

    deleteQueueConfig: (queueType: string, queueName: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      EventResource.deleteQueueConfig({
        client,
        path: { queueType, queueName },
        throwOnError: true,
      });
    },

    getEventHandlers: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return EventResource.getEventHandlers({
        client,
        throwOnError: true,
      });
    },

    updateEventHandler: (body: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      EventResource.updateEventHandler({
        client,
        body,
        throwOnError: true,
      });
    },

    addEventHandler: (body: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      EventResource.addEventHandler({
        client,
        body,
        throwOnError: true,
      });
    },

    getQueueNames: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return EventResource.getQueueNames({
        client,
        throwOnError: true,
      });
    },

    removeEventHandlerStatus: (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      EventResource.removeEventHandlerStatus({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    getEventHandlersForEvent: (event: string, activeOnly: boolean = true) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return EventResource.getEventHandlersForEvent({
        client,
        path: { event },
        query: { activeOnly },
        throwOnError: true,
      });
    },

    deleteTagForEventHandler: (name: string, body: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      EventResource.deleteTagForEventHandler({
        client,
        path: { name },
        body,
        throwOnError: true,
      });
    },

    getTagsForEventHandler: (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return EventResource.getTagsForEventHandler({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    putTagForEventHandler: (name: string, body: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      EventResource.putTagForEventHandler({
        client,
        path: { name },
        body,
        throwOnError: true,
      });
    },
  };

  (client as any).healthCheckResource = {
    doCheck: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return HealthCheckResource.doCheck({
        client,
        throwOnError: true,
      });
    },
  };

  (client as any).metadataResource = {
    getTaskDef: (tasktype: string, metadata: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return MetadataResource.getTaskDef({
        client,
        path: { tasktype },
        query: { metadata },
        throwOnError: true,
      });
    },

    unregisterTaskDef: (tasktype: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      MetadataResource.unregisterTaskDef({
        client,
        path: { tasktype },
        throwOnError: true,
      });
    },

    getAllWorkflows: (
      access: string = "READ",
      metadata: boolean = false,
      tagKey?: string,
      tagValue?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return MetadataResource.getWorkflowDefs({
        client,
        query: { access, metadata, tagKey, tagValue },
        throwOnError: true,
      });
    },

    update: (requestBody: any[], overwrite: boolean = true) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      MetadataResource.update({
        client,
        body: requestBody,
        query: { overwrite },
        throwOnError: true,
      });
    },

    create: (requestBody: any, overwrite: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      MetadataResource.create({
        client,
        body: requestBody,
        query: { overwrite },
        throwOnError: true,
      });
    },

    getTaskDefs: (
      access: string = "READ",
      metadata: boolean = false,
      tagKey?: string,
      tagValue?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return MetadataResource.getTaskDefs({
        client,
        query: { access, metadata, tagKey, tagValue },
        throwOnError: true,
      });
    },

    updateTaskDef: (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      MetadataResource.updateTaskDef({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    registerTaskDef: (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      MetadataResource.registerTaskDef({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    unregisterWorkflowDef: (name: string, version: number) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      MetadataResource.unregisterWorkflowDef({
        client,
        path: { name, version },
        throwOnError: true,
      });
    },

    get: (name: string, version?: number, metadata: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return MetadataResource.get1({
        client,
        path: { name },
        query: { version, metadata },
        throwOnError: true,
      });
    },
  };

  (client as any).schedulerResource = {
    getSchedule: (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return SchedulerResource.getSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    deleteSchedule: (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      SchedulerResource.deleteSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    getNextFewSchedules: (
      cronExpression: string,
      scheduleStartTime?: number,
      scheduleEndTime?: number,
      limit: number = 3
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return SchedulerResource.getNextFewSchedules({
        client,
        query: { cronExpression, scheduleStartTime, scheduleEndTime, limit },
        throwOnError: true,
      });
    },

    pauseSchedule: (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      SchedulerResource.pauseSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    pauseAllSchedules: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return SchedulerResource.pauseAllSchedules({
        client,
        throwOnError: true,
      });
    },

    resumeSchedule: (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      SchedulerResource.resumeSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    requeueAllExecutionRecords: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return SchedulerResource.requeueAllExecutionRecords({
        client,
        throwOnError: true,
      });
    },

    resumeAllSchedules: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return SchedulerResource.resumeAllSchedules({
        client,
        throwOnError: true,
      });
    },

    getAllSchedules: (workflowName?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return SchedulerResource.getAllSchedules({
        client,
        query: { workflowName },
        throwOnError: true,
      });
    },

    saveSchedule: (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      SchedulerResource.saveSchedule({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    searchV21: (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return SchedulerResource.searchV2({
        client,
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
    },

    testTimeout: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/scheduler/test/timeout",
        throwOnError: true,
      });
    },
  };

  (client as any).tokenResource = {
    generateToken: (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TokenResource.generateToken({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    getUserInfo: (claims: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TokenResource.getUserInfo({
        client,
        query: { claims },
        throwOnError: true,
      });
    },
  };

  (client as any).workflowBulkResource = {
    retry: (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowBulkResource.retry1({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    restart: (requestBody: any[], useLatestDefinitions: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowBulkResource.restart1({
        client,
        body: requestBody,
        query: { useLatestDefinitions },
        throwOnError: true,
      });
    },

    terminate: (requestBody: any[], reason?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowBulkResource.terminate({
        client,
        body: requestBody,
        query: { reason },
        throwOnError: true,
      });
    },

    resumeWorkflow: (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowBulkResource.resumeWorkflow1({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    pauseWorkflow1: (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowBulkResource.pauseWorkflow1({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },
  };

  (client as any).workflowResource = {
    getRunningWorkflow: (
      name: string,
      version: number = 1,
      startTime?: number,
      endTime?: number
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.getRunningWorkflow({
        client,
        path: { name },
        query: { version, startTime, endTime },
        throwOnError: true,
      });
    },

    executeWorkflow: (
      body: any,
      name: string,
      version: number,
      requestId?: string,
      waitUntilTaskRef?: string,
      waitForSeconds?: number,
      consistency?: any,
      returnStrategy?: any
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.executeWorkflow({
        client,
        path: { name, version },
        query: {
          requestId,
          waitUntilTaskRef,
          waitForSeconds,
          consistency,
          returnStrategy,
        },
        body,
        throwOnError: true,
      });
    },

    startWorkflow: (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.startWorkflow({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    decide: (workflowId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.decide({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },

    rerun: (workflowId: string, requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.rerun({
        client,
        path: { workflowId },
        body: requestBody,
        throwOnError: true,
      });
    },

    searchV21: (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/workflow/search-v2",
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
    },

    pauseWorkflow: (workflowId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.pauseWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },

    skipTaskFromWorkflow: (
      workflowId: string,
      taskReferenceName: string,
      requestBody?: any
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.skipTaskFromWorkflow({
        client,
        path: { workflowId, taskReferenceName },
        body: requestBody,
        throwOnError: true,
      });
    },

    getWorkflows: (
      name: string,
      requestBody: any[],
      includeClosed: boolean = false,
      includeTasks: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.getWorkflows({
        client,
        path: { name },
        query: { includeClosed, includeTasks },
        body: requestBody,
        throwOnError: true,
      });
    },

    getWorkflowStatusSummary: (
      workflowId: string,
      includeOutput: boolean = false,
      includeVariables: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.getWorkflowStatusSummary({
        client,
        path: { workflowId },
        query: { includeOutput, includeVariables },
        throwOnError: true,
      });
    },

    getWorkflows1: (
      name: string,
      correlationId: string,
      includeClosed: boolean = false,
      includeTasks: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.getWorkflows2({
        client,
        path: { name, correlationId },
        query: { includeClosed, includeTasks },
        throwOnError: true,
      });
    },

    retry1: (workflowId: string, resumeSubworkflowTasks: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.retry({
        client,
        path: { workflowId },
        query: { resumeSubworkflowTasks },
        throwOnError: true,
      });
    },

    getExecutionStatus: (workflowId: string, includeTasks: boolean = true) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.getExecutionStatus({
        client,
        path: { workflowId },
        query: { includeTasks },
        throwOnError: true,
      });
    },

    terminate1: (workflowId: string, reason?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.terminate1({
        client,
        path: { workflowId },
        query: { reason },
        throwOnError: true,
      });
    },

    resumeWorkflow: (workflowId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.resumeWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },

    delete: (workflowId: string, archiveWorkflow: boolean = true) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.delete1({
        client,
        path: { workflowId },
        query: { archiveWorkflow },
        throwOnError: true,
      });
    },

    searchWorkflowsByTasks: (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/workflow/search-by-tasks",
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
    },

    getExternalStorageLocation: (
      path: string,
      operation: string,
      payloadType: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/workflow/externalstoragelocation",
        query: { path, operation, payloadType },
        throwOnError: true,
      });
    },

    startWorkflow1: (
      name: string,
      requestBody: any,
      version?: number,
      correlationId?: string,
      priority?: number
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.startWorkflow1({
        client,
        path: { name },
        query: { version, correlationId, priority },
        body: requestBody,
        throwOnError: true,
      });
    },

    restart1: (workflowId: string, useLatestDefinitions: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.restart({
        client,
        path: { workflowId },
        query: { useLatestDefinitions },
        throwOnError: true,
      });
    },

    search1: (
      queryId?: string,
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string,
      skipCache: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/workflow/search",
        query: { queryId, start, size, sort, freeText, query, skipCache },
        throwOnError: true,
      });
    },

    searchWorkflowsByTasksV2: (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/workflow/search-by-tasks-v2",
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
    },

    resetWorkflow: (workflowId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      WorkflowResource.resetWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },

    testWorkflow: (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return WorkflowResource.testWorkflow({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },
  };

  (client as any).taskResource = {
    poll: (tasktype: string, workerid?: string, domain?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.poll({
        client,
        path: { tasktype },
        query: { workerid, domain },
        throwOnError: true,
      });
    },

    allVerbose: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.allVerbose({
        client,
        throwOnError: true,
      });
    },

    updateTask: (
      workflowId: string,
      taskRefName: string,
      status:
        | "IN_PROGRESS"
        | "FAILED"
        | "FAILED_WITH_TERMINAL_ERROR"
        | "COMPLETED",
      requestBody: any
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.updateTask1({
        client,
        path: { workflowId, taskRefName, status },
        body: requestBody,
        throwOnError: true,
      });
    },

    getTask: (taskId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.getTask({
        client,
        path: { taskId },
        throwOnError: true,
      });
    },

    all: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.all({
        client,
        throwOnError: true,
      });
    },

    requeuePendingTask: (taskType: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.requeuePendingTask({
        client,
        path: { taskType },
        throwOnError: true,
      });
    },

    search: (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.search2({
        client,
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
    },

    searchV22: (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/tasks/search-v2",
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
    },

    getPollData: (taskType: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.getPollData({
        client,
        query: { taskType },
        throwOnError: true,
      });
    },

    getTaskLogs: (taskId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.getTaskLogs({
        client,
        path: { taskId },
        throwOnError: true,
      });
    },

    log: (taskId: string, requestBody: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      TaskResource.log({
        client,
        path: { taskId },
        body: requestBody,
        throwOnError: true,
      });
    },

    getAllPollData: () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.getAllPollData({
        client,
        throwOnError: true,
      });
    },

    batchPoll: (
      tasktype: string,
      workerid?: string,
      domain?: string,
      count: number = 1,
      timeout: number = 100
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.batchPoll({
        client,
        path: { tasktype },
        query: { workerid, domain, count, timeout },
        throwOnError: true,
      });
    },

    updateTask1: (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.updateTask({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    size1: (taskType?: string[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.size({
        client,
        query: { taskType },
        throwOnError: true,
      });
    },

    getExternalStorageLocation1: (
      path: string,
      operation: string,
      payloadType: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/tasks/externalstoragelocation",
        query: { path, operation, payloadType },
        throwOnError: true,
      });
    },

    updateTaskSync: (
      workflowId: string,
      taskRefName: string,
      status: any,
      output: any,
      workerId?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.updateTaskSync({
        client,
        path: { workflowId, taskRefName, status },
        query: { workerid: workerId },
        body: output,
        throwOnError: true,
      });
    },

    signal: (
      workflowId: string,
      status: any,
      output: any,
      returnStrategy: any = "TARGET_WORKFLOW"
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      return TaskResource.signalWorkflowTaskSync({
        client,
        path: { workflowId, status },
        query: { returnStrategy },
        body: output,
        throwOnError: true,
      });
    },

    signalAsync: (workflowId: string, status: any, output: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      TaskResource.signalWorkflowTaskASync({
        client,
        path: { workflowId, status },
        body: output,
        throwOnError: true,
      });
    },
  };
};
