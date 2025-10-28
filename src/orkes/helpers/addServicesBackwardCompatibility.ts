import { SignalResponse } from "../../common";
import { Client } from "../../common/open-api/client/types.gen";
import {
  EventResource,
  HumanTask,
  HumanTaskResource,
  UserForm,
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
    getQueueConfig: async (queueType: string, queueName: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await EventResource.getQueueConfig({
        client,
        path: { queueType, queueName },
        throwOnError: true,
      });
      return data;
    },

    putQueueConfig: async (
      queueType: string,
      queueName: string,
      body: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await EventResource.putQueueConfig({
        client,
        path: { queueType, queueName },
        body,
        throwOnError: true,
      });
    },

    deleteQueueConfig: async (queueType: string, queueName: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await EventResource.deleteQueueConfig({
        client,
        path: { queueType, queueName },
        throwOnError: true,
      });
    },

    getEventHandlers: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await EventResource.getEventHandlers({
        client,
        throwOnError: true,
      });
      return data;
    },

    updateEventHandler: async (body: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await EventResource.updateEventHandler({
        client,
        body,
        throwOnError: true,
      });
    },

    addEventHandler: async (body: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await EventResource.addEventHandler({
        client,
        body,
        throwOnError: true,
      });
    },

    getQueueNames: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await EventResource.getQueueNames({
        client,
        throwOnError: true,
      });
      return data;
    },

    removeEventHandlerStatus: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await EventResource.removeEventHandlerStatus({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    getEventHandlersForEvent: async (
      event: string,
      activeOnly: boolean = true
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await EventResource.getEventHandlersForEvent({
        client,
        path: { event },
        query: { activeOnly },
        throwOnError: true,
      });
      return data;
    },

    deleteTagForEventHandler: async (name: string, body: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await EventResource.deleteTagForEventHandler({
        client,
        path: { name },
        body,
        throwOnError: true,
      });
    },

    getTagsForEventHandler: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await EventResource.getTagsForEventHandler({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },

    putTagForEventHandler: async (name: string, body: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await EventResource.putTagForEventHandler({
        client,
        path: { name },
        body,
        throwOnError: true,
      });
    },
  };

  (client as any).healthCheckResource = {
    doCheck: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await HealthCheckResource.doCheck({
        client,
        throwOnError: true,
      });
      return data;
    },
  };

  (client as any).metadataResource = {
    getTaskDef: async (tasktype: string, metadata: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await MetadataResource.getTaskDef({
        client,
        path: { tasktype },
        query: { metadata },
        throwOnError: true,
      });
      return data;
    },

    unregisterTaskDef: async (tasktype: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await MetadataResource.unregisterTaskDef({
        client,
        path: { tasktype },
        throwOnError: true,
      });
    },

    getAllWorkflows: async (
      access: string = "READ",
      metadata: boolean = false,
      tagKey?: string,
      tagValue?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await MetadataResource.getWorkflowDefs({
        client,
        query: { access, metadata, tagKey, tagValue },
        throwOnError: true,
      });
      return data;
    },

    update: async (requestBody: any[], overwrite: boolean = true) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await MetadataResource.update({
        client,
        body: requestBody,
        query: { overwrite },
        throwOnError: true,
      });
    },

    create: async (requestBody: any, overwrite: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await MetadataResource.create({
        client,
        body: requestBody,
        query: { overwrite },
        throwOnError: true,
      });
    },

    getTaskDefs: async (
      access: string = "READ",
      metadata: boolean = false,
      tagKey?: string,
      tagValue?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await MetadataResource.getTaskDefs({
        client,
        query: { access, metadata, tagKey, tagValue },
        throwOnError: true,
      });
      return data;
    },

    updateTaskDef: async (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await MetadataResource.updateTaskDef({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    registerTaskDef: async (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await MetadataResource.registerTaskDef({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    unregisterWorkflowDef: async (name: string, version: number) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await MetadataResource.unregisterWorkflowDef({
        client,
        path: { name, version },
        throwOnError: true,
      });
    },

    get: async (name: string, version?: number, metadata: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await MetadataResource.get1({
        client,
        path: { name },
        query: { version, metadata },
        throwOnError: true,
      });
      return data;
    },
  };

  (client as any).schedulerResource = {
    getSchedule: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await SchedulerResource.getSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },

    deleteSchedule: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await SchedulerResource.deleteSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    getNextFewSchedules: async (
      cronExpression: string,
      scheduleStartTime?: number,
      scheduleEndTime?: number,
      limit: number = 3
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await SchedulerResource.getNextFewSchedules({
        client,
        query: { cronExpression, scheduleStartTime, scheduleEndTime, limit },
        throwOnError: true,
      });
      return data;
    },

    pauseSchedule: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await SchedulerResource.pauseSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    pauseAllSchedules: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await SchedulerResource.pauseAllSchedules({
        client,
        throwOnError: true,
      });
      return data;
    },

    resumeSchedule: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await SchedulerResource.resumeSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    requeueAllExecutionRecords: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await SchedulerResource.requeueAllExecutionRecords({
        client,
        throwOnError: true,
      });
      return data;
    },

    resumeAllSchedules: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await SchedulerResource.resumeAllSchedules({
        client,
        throwOnError: true,
      });
      return data;
    },

    getAllSchedules: async (workflowName?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await SchedulerResource.getAllSchedules({
        client,
        query: { workflowName },
        throwOnError: true,
      });
      return data;
    },

    saveSchedule: async (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await SchedulerResource.saveSchedule({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    searchV21: async (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await SchedulerResource.searchV2({
        client,
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
      return data;
    },

    testTimeout: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await client.get({
        security: [
          {
            name: "X-Authorization",
            type: "apiKey",
          },
        ],
        url: "/api/scheduler/test/timeout",
        throwOnError: true,
      });
      return data as any;
    },
  };

  (client as any).tokenResource = {
    generateToken: async (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TokenResource.generateToken({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    getUserInfo: async (claims: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TokenResource.getUserInfo({
        client,
        query: { claims },
        throwOnError: true,
      });
      return data;
    },
  };

  (client as any).workflowBulkResource = {
    retry: async (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowBulkResource.retry1({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    restart: async (
      requestBody: any[],
      useLatestDefinitions: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowBulkResource.restart1({
        client,
        body: requestBody,
        query: { useLatestDefinitions },
        throwOnError: true,
      });
      return data;
    },

    terminate: async (requestBody: any[], reason?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowBulkResource.terminate({
        client,
        body: requestBody,
        query: { reason },
        throwOnError: true,
      });
      return data;
    },

    resumeWorkflow: async (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowBulkResource.resumeWorkflow1({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    pauseWorkflow1: async (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowBulkResource.pauseWorkflow1({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
  };

  (client as any).workflowResource = {
    getRunningWorkflow: async (
      name: string,
      version: number = 1,
      startTime?: number,
      endTime?: number
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.getRunningWorkflow({
        client,
        path: { name },
        query: { version, startTime, endTime },
        throwOnError: true,
      });
      return data;
    },

    executeWorkflow: async (
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
      const { data } = await WorkflowResource.executeWorkflow({
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
      return data;
    },

    startWorkflow: async (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.startWorkflow({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    decide: async (workflowId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.decide({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },

    rerun: async (workflowId: string, requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.rerun({
        client,
        path: { workflowId },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    searchV21: async (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await client.get({
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
      return data as any;
    },

    pauseWorkflow: async (workflowId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.pauseWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },

    skipTaskFromWorkflow: async (
      workflowId: string,
      taskReferenceName: string,
      requestBody?: any
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.skipTaskFromWorkflow({
        client,
        path: { workflowId, taskReferenceName },
        body: requestBody,
        throwOnError: true,
      });
    },

    getWorkflows: async (
      name: string,
      requestBody: any[],
      includeClosed: boolean = false,
      includeTasks: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.getWorkflows({
        client,
        path: { name },
        query: { includeClosed, includeTasks },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    getWorkflowStatusSummary: async (
      workflowId: string,
      includeOutput: boolean = false,
      includeVariables: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.getWorkflowStatusSummary({
        client,
        path: { workflowId },
        query: { includeOutput, includeVariables },
        throwOnError: true,
      });
      return data;
    },

    getWorkflows1: async (
      name: string,
      correlationId: string,
      includeClosed: boolean = false,
      includeTasks: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.getWorkflows2({
        client,
        path: { name, correlationId },
        query: { includeClosed, includeTasks },
        throwOnError: true,
      });
      return data;
    },

    retry1: async (
      workflowId: string,
      resumeSubworkflowTasks: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.retry({
        client,
        path: { workflowId },
        query: { resumeSubworkflowTasks },
        throwOnError: true,
      });
    },

    getExecutionStatus: async (
      workflowId: string,
      includeTasks: boolean = true
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.getExecutionStatus({
        client,
        path: { workflowId },
        query: { includeTasks },
        throwOnError: true,
      });
      return data;
    },

    terminate1: async (workflowId: string, reason?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.terminate1({
        client,
        path: { workflowId },
        query: { reason },
        throwOnError: true,
      });
    },

    resumeWorkflow: async (workflowId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.resumeWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },

    delete: async (workflowId: string, archiveWorkflow: boolean = true) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.delete1({
        client,
        path: { workflowId },
        query: { archiveWorkflow },
        throwOnError: true,
      });
    },

    searchWorkflowsByTasks: async (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await client.get({
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
      return data as any;
    },

    getExternalStorageLocation: async (
      path: string,
      operation: string,
      payloadType: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await client.get({
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
      return data as any;
    },

    startWorkflow1: async (
      name: string,
      requestBody: any,
      version?: number,
      correlationId?: string,
      priority?: number
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.startWorkflow1({
        client,
        path: { name },
        query: { version, correlationId, priority },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    restart1: async (
      workflowId: string,
      useLatestDefinitions: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.restart({
        client,
        path: { workflowId },
        query: { useLatestDefinitions },
        throwOnError: true,
      });
    },

    search1: async (
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
      const { data } = await client.get({
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
      return data as any;
    },

    searchWorkflowsByTasksV2: async (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await client.get({
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
      return data as any;
    },

    resetWorkflow: async (workflowId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await WorkflowResource.resetWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },

    testWorkflow: async (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await WorkflowResource.testWorkflow({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
  };

  (client as any).serviceRegistryResource = {
    getRegisteredServices: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await ServiceRegistryResource.getRegisteredServices({
        client,
        throwOnError: true,
      });
      return data;
    },

    removeService: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await ServiceRegistryResource.removeService({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    getService: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await ServiceRegistryResource.getService({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },

    openCircuitBreaker: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await ServiceRegistryResource.openCircuitBreaker({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },

    closeCircuitBreaker: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await ServiceRegistryResource.closeCircuitBreaker({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },

    getCircuitBreakerStatus: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await ServiceRegistryResource.getCircuitBreakerStatus({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },

    addOrUpdateService: async (serviceRegistry: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await ServiceRegistryResource.addOrUpdateService({
        client,
        body: serviceRegistry,
        throwOnError: true,
      });
    },

    addOrUpdateServiceMethod: async (registryName: string, method: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await ServiceRegistryResource.addOrUpdateMethod({
        client,
        path: { registryName },
        body: method,
        throwOnError: true,
      });
    },

    removeMethod: async (
      registryName: string,
      serviceName: string,
      method: string,
      methodType: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await ServiceRegistryResource.removeMethod({
        client,
        path: { registryName },
        query: { serviceName, method, methodType },
        throwOnError: true,
      });
    },

    getProtoData: async (registryName: string, filename: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await ServiceRegistryResource.getProtoData({
        client,
        path: { registryName, filename },
        throwOnError: true,
      });
      return data;
    },

    setProtoData: async (registryName: string, filename: string, data: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await ServiceRegistryResource.setProtoData({
        client,
        path: { registryName, filename },
        body: data,
        throwOnError: true,
      });
    },

    deleteProto: async (registryName: string, filename: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await ServiceRegistryResource.deleteProto({
        client,
        path: { registryName, filename },
        throwOnError: true,
      });
    },

    getAllProtos: async (registryName: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await ServiceRegistryResource.getAllProtos({
        client,
        path: { registryName },
        throwOnError: true,
      });
      return data;
    },

    discover: async (name: string, create: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await ServiceRegistryResource.discover({
        client,
        path: { name },
        query: { create },
        throwOnError: true,
      });
      return data;
    },
  };

  (client as any).humanTaskResource = {
    getConductorTaskById: async (taskId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await HumanTaskResource.getConductorTaskById({
        client,
        path: { taskId },
        throwOnError: true,
      });
      return data;
    },
  };

  (client as any).humanTask = {
    deleteTaskFromHumanTaskRecords: async (requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await HumanTask.deleteTaskFromHumanTaskRecords({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },

    deleteTaskFromHumanTaskRecords1: async (taskId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await HumanTask.deleteTaskFromHumanTaskRecords1({
        client,
        path: { taskId },
        throwOnError: true,
      });
    },

    search: async (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await HumanTask.search({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    updateTaskOutputByRef: async (
      workflowId: string,
      taskRefName: string,
      requestBody: any,
      complete: boolean = false,
      iteration?: any[]
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await HumanTask.updateTaskOutputByRef({
        client,
        query: {
          workflowId,
          taskRefName,
          complete,
          iteration,
        },
        body: requestBody,
        throwOnError: true,
      });
      return data as any;
    },

    getTask1: async (taskId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await HumanTask.getTask1({
        client,
        path: { taskId },
        throwOnError: true,
      });
      return data;
    },

    claimTask: async (
      taskId: string,
      overrideAssignment: boolean = false,
      withTemplate: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await HumanTask.claimTask({
        client,
        path: { taskId },
        query: { overrideAssignment, withTemplate },
        throwOnError: true,
      });
      return data;
    },

    assignAndClaim: async (
      taskId: string,
      userId: string,
      overrideAssignment: boolean = false,
      withTemplate: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await HumanTask.assignAndClaim({
        client,
        path: { taskId, userId },
        query: { overrideAssignment, withTemplate },
        throwOnError: true,
      });
      return data;
    },

    reassignTask: async (taskId: string, requestBody: any[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await HumanTask.reassignTask({
        client,
        path: { taskId },
        body: requestBody,
        throwOnError: true,
      });
    },

    releaseTask: async (taskId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await HumanTask.releaseTask({
        client,
        path: { taskId },
        throwOnError: true,
      });
    },

    skipTask: async (taskId: string, reason?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await HumanTask.skipTask({
        client,
        path: { taskId },
        query: { reason },
        throwOnError: true,
      });
    },

    updateTaskOutput: async (
      taskId: string,
      requestBody: any,
      complete: boolean = false
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await HumanTask.updateTaskOutput({
        client,
        path: { taskId },
        query: { complete },
        body: requestBody,
        throwOnError: true,
      });
    },

    getAllTemplates: async (name?: string, version?: number) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await UserForm.getAllTemplates({
        client,
        query: { name, version },
        throwOnError: true,
      });
      return data;
    },

    saveTemplate: async (requestBody: any, newVersion: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await UserForm.saveTemplate({
        client,
        query: { newVersion },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    saveTemplates: async (requestBody: any[], newVersion: boolean = false) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await UserForm.saveTemplates({
        client,
        query: { newVersion },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    deleteTemplateByName: async (name: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await UserForm.deleteTemplateByName({
        client,
        path: { name },
        throwOnError: true,
      });
    },

    deleteTemplatesByNameAndVersion: async (name: string, version: number) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await HumanTask.deleteTemplatesByNameAndVersion({
        client,
        path: { name, version },
        throwOnError: true,
      });
    },

    getTemplateByNameAndVersion: async (name: string, version: number) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await UserForm.getTemplateByNameAndVersion({
        client,
        path: { name, version },
        throwOnError: true,
      });
      return data;
    },
  };

  (client as any).taskResource = {
    poll: async (tasktype: string, workerid?: string, domain?: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.poll({
        client,
        path: { tasktype },
        query: { workerid, domain },
        throwOnError: true,
      });
      return data;
    },

    allVerbose: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.allVerbose({
        client,
        throwOnError: true,
      });
      return data;
    },

    updateTask: async (
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
      const { data } = await TaskResource.updateTask1({
        client,
        path: { workflowId, taskRefName, status },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    getTask: async (taskId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.getTask({
        client,
        path: { taskId },
        throwOnError: true,
      });
      return data;
    },

    all: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.all({
        client,
        throwOnError: true,
      });
      return data;
    },

    requeuePendingTask: async (taskType: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.requeuePendingTask({
        client,
        path: { taskType },
        throwOnError: true,
      });
      return data;
    },

    search: async (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.search2({
        client,
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
      return data;
    },

    searchV22: async (
      start?: number,
      size: number = 100,
      sort?: string,
      freeText: string = "*",
      query?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await client.get({
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
      return data as any;
    },

    getPollData: async (taskType: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.getPollData({
        client,
        query: { taskType },
        throwOnError: true,
      });
      return data;
    },

    getTaskLogs: async (taskId: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.getTaskLogs({
        client,
        path: { taskId },
        throwOnError: true,
      });
      return data;
    },

    log: async (taskId: string, requestBody: string) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      await TaskResource.log({
        client,
        path: { taskId },
        body: requestBody,
        throwOnError: true,
      });
    },

    getAllPollData: async () => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.getAllPollData({
        client,
        throwOnError: true,
      });
      return data;
    },

    batchPoll: async (
      tasktype: string,
      workerid?: string,
      domain?: string,
      count: number = 1,
      timeout: number = 100
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.batchPoll({
        client,
        path: { tasktype },
        query: { workerid, domain, count, timeout },
        throwOnError: true,
      });
      return data;
    },

    updateTask1: async (requestBody: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.updateTask({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    size1: async (taskType?: string[]) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.size({
        client,
        query: { taskType },
        throwOnError: true,
      });
      return data;
    },

    getExternalStorageLocation1: async (
      path: string,
      operation: string,
      payloadType: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await client.get({
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
      return data as any;
    },

    updateTaskSync: async (
      workflowId: string,
      taskRefName: string,
      status: any,
      output: any,
      workerId?: string
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.updateTaskSync({
        client,
        path: { workflowId, taskRefName, status },
        query: { workerid: workerId },
        body: output,
        throwOnError: true,
      });
      return data;
    },

    signal: async (
      workflowId: string,
      status: any,
      output: any,
      returnStrategy: any = "TARGET_WORKFLOW"
    ) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.signalWorkflowTaskSync({
        client,
        path: { workflowId, status },
        query: { returnStrategy },
        body: output,
        throwOnError: true,
      });
      return data;
    },

    signalAsync: async (workflowId: string, status: any, output: any) => {
      console.warn(
        "DEPRECATED: Accessing methods directly on the client is deprecated and will be removed after April 2026"
      );
      const { data } = await TaskResource.signalWorkflowTaskASync({
        client,
        path: { workflowId, status },
        body: output,
        throwOnError: true,
      });
      return data as SignalResponse;
    },
  };
};
