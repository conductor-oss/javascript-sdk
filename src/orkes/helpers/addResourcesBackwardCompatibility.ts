/* eslint-disable */
// disable linter since related old functionality was not properly typed
// TODO: everything in this file is DEPRECATED and whole file should be removed after April 2026

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

const warn = () => {
  console.warn(
    "[Conductor SDK Deprecation Warning] Accessing resources directly on the client is deprecated and will be removed after April 2026"
  );
};

export const addResourcesBackwardCompatibility = (client: Client) => {
  const eventResource = {
    /**
     * @deprecated
     */
    getQueueConfig: async (queueType: string, queueName: string) => {
      warn();
      const { data } = await EventResource.getQueueConfig({
        client,
        path: { queueType, queueName },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    putQueueConfig: async (
      queueType: string,
      queueName: string,
      body: string
    ) => {
      warn();
      await EventResource.putQueueConfig({
        client,
        path: { queueType, queueName },
        body,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    deleteQueueConfig: async (queueType: string, queueName: string) => {
      warn();
      await EventResource.deleteQueueConfig({
        client,
        path: { queueType, queueName },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getEventHandlers: async () => {
      warn();
      const { data } = await EventResource.getEventHandlers({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    updateEventHandler: async (body: any) => {
      warn();
      await EventResource.updateEventHandler({
        client,
        body,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    addEventHandler: async (body: any) => {
      warn();
      await EventResource.addEventHandler({
        client,
        body,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getQueueNames: async () => {
      warn();
      const { data } = await EventResource.getQueueNames({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    removeEventHandlerStatus: async (name: string) => {
      warn();
      await EventResource.removeEventHandlerStatus({
        client,
        path: { name },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getEventHandlersForEvent: async (event: string, activeOnly = true) => {
      warn();
      const { data } = await EventResource.getEventHandlersForEvent({
        client,
        path: { event },
        query: { activeOnly },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    deleteTagForEventHandler: async (name: string, body: any[]) => {
      warn();
      await EventResource.deleteTagForEventHandler({
        client,
        path: { name },
        body,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getTagsForEventHandler: async (name: string) => {
      warn();
      const { data } = await EventResource.getTagsForEventHandler({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    putTagForEventHandler: async (name: string, body: any[]) => {
      warn();
      await EventResource.putTagForEventHandler({
        client,
        path: { name },
        body,
        throwOnError: true,
      });
    },
  };
  const healthCheckResource = {
    doCheck: async () => {
      warn();
      const { data } = await HealthCheckResource.doCheck({
        client,
        throwOnError: true,
      });
      return data;
    },
  };
  const metadataResource = {
    getTaskDef: async (tasktype: string, metadata = false) => {
      warn();
      const { data } = await MetadataResource.getTaskDef({
        client,
        path: { tasktype },
        query: { metadata },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    unregisterTaskDef: async (tasktype: string) => {
      warn();
      await MetadataResource.unregisterTaskDef({
        client,
        path: { tasktype },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getAllWorkflows: async (
      access = "READ",
      metadata = false,
      tagKey?: string,
      tagValue?: string
    ) => {
      warn();
      const { data } = await MetadataResource.getWorkflowDefs({
        client,
        query: { access, metadata, tagKey, tagValue },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    update: async (requestBody: any[], overwrite = true) => {
      warn();
      await MetadataResource.update({
        client,
        body: requestBody,
        query: { overwrite },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    create: async (requestBody: any, overwrite = false) => {
      warn();
      await MetadataResource.create({
        client,
        body: requestBody,
        query: { overwrite },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getTaskDefs: async (
      access = "READ",
      metadata = false,
      tagKey?: string,
      tagValue?: string
    ) => {
      warn();
      const { data } = await MetadataResource.getTaskDefs({
        client,
        query: { access, metadata, tagKey, tagValue },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    updateTaskDef: async (requestBody: any) => {
      warn();
      await MetadataResource.updateTaskDef({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    registerTaskDef: async (requestBody: any[]) => {
      warn();
      await MetadataResource.registerTaskDef({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    unregisterWorkflowDef: async (name: string, version: number) => {
      warn();
      await MetadataResource.unregisterWorkflowDef({
        client,
        path: { name, version },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    get: async (name: string, version?: number, metadata = false) => {
      warn();
      const { data } = await MetadataResource.get1({
        client,
        path: { name },
        query: { version, metadata },
        throwOnError: true,
      });
      return data;
    },
  };
  const schedulerResource = {
    getSchedule: async (name: string) => {
      warn();
      const { data } = await SchedulerResource.getSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    deleteSchedule: async (name: string) => {
      warn();
      await SchedulerResource.deleteSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getNextFewSchedules: async (
      cronExpression: string,
      scheduleStartTime?: number,
      scheduleEndTime?: number,
      limit = 3
    ) => {
      warn();
      const { data } = await SchedulerResource.getNextFewSchedules({
        client,
        query: { cronExpression, scheduleStartTime, scheduleEndTime, limit },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    pauseSchedule: async (name: string) => {
      warn();
      await SchedulerResource.pauseSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    pauseAllSchedules: async () => {
      warn();
      const { data } = await SchedulerResource.pauseAllSchedules({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    resumeSchedule: async (name: string) => {
      warn();
      await SchedulerResource.resumeSchedule({
        client,
        path: { name },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    requeueAllExecutionRecords: async () => {
      warn();
      const { data } = await SchedulerResource.requeueAllExecutionRecords({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    resumeAllSchedules: async () => {
      warn();
      const { data } = await SchedulerResource.resumeAllSchedules({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    getAllSchedules: async (workflowName?: string) => {
      warn();
      const { data } = await SchedulerResource.getAllSchedules({
        client,
        query: { workflowName },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    saveSchedule: async (requestBody: any) => {
      warn();
      await SchedulerResource.saveSchedule({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    searchV21: async (
      start?: number,
      size = 100,
      sort?: string,
      freeText = "*",
      query?: string
    ) => {
      warn();
      const { data } = await SchedulerResource.searchV2({
        client,
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    testTimeout: async () => {
      warn();
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

  const tokenResource = {
    generateToken: async (requestBody: any) => {
      warn();
      const { data } = await TokenResource.generateToken({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },

    getUserInfo: async (claims = false) => {
      warn();
      const { data } = await TokenResource.getUserInfo({
        client,
        query: { claims },
        throwOnError: true,
      });
      return data;
    },
  };

  const workflowBulkResource = {
    retry: async (requestBody: any[]) => {
      warn();
      const { data } = await WorkflowBulkResource.retry1({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    restart: async (requestBody: any[], useLatestDefinitions = false) => {
      warn();
      const { data } = await WorkflowBulkResource.restart1({
        client,
        body: requestBody,
        query: { useLatestDefinitions },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    terminate: async (requestBody: any[], reason?: string) => {
      warn();
      const { data } = await WorkflowBulkResource.terminate({
        client,
        body: requestBody,
        query: { reason },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    resumeWorkflow: async (requestBody: any[]) => {
      warn();
      const { data } = await WorkflowBulkResource.resumeWorkflow1({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    pauseWorkflow1: async (requestBody: any[]) => {
      warn();
      const { data } = await WorkflowBulkResource.pauseWorkflow1({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
  };

  const workflowResource = {
    getRunningWorkflow: async (
      name: string,
      version = 1,
      startTime?: number,
      endTime?: number
    ) => {
      warn();
      const { data } = await WorkflowResource.getRunningWorkflow({
        client,
        path: { name },
        query: { version, startTime, endTime },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
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
      warn();
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
    /**
     * @deprecated
     */
    startWorkflow: async (requestBody: any) => {
      warn();
      const { data } = await WorkflowResource.startWorkflow({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    decide: async (workflowId: string) => {
      warn();
      await WorkflowResource.decide({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    rerun: async (workflowId: string, requestBody: any) => {
      warn();
      const { data } = await WorkflowResource.rerun({
        client,
        path: { workflowId },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    searchV21: async (
      start?: number,
      size = 100,
      sort?: string,
      freeText = "*",
      query?: string
    ) => {
      warn();
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
    /**
     * @deprecated
     */
    pauseWorkflow: async (workflowId: string) => {
      warn();
      await WorkflowResource.pauseWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    skipTaskFromWorkflow: async (
      workflowId: string,
      taskReferenceName: string,
      requestBody?: any
    ) => {
      warn();
      await WorkflowResource.skipTaskFromWorkflow({
        client,
        path: { workflowId, taskReferenceName },
        body: requestBody,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getWorkflows: async (
      name: string,
      requestBody: any[],
      includeClosed = false,
      includeTasks = false
    ) => {
      warn();
      const { data } = await WorkflowResource.getWorkflows({
        client,
        path: { name },
        query: { includeClosed, includeTasks },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    getWorkflowStatusSummary: async (
      workflowId: string,
      includeOutput = false,
      includeVariables = false
    ) => {
      warn();
      const { data } = await WorkflowResource.getWorkflowStatusSummary({
        client,
        path: { workflowId },
        query: { includeOutput, includeVariables },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    getWorkflows1: async (
      name: string,
      correlationId: string,
      includeClosed = false,
      includeTasks = false
    ) => {
      warn();
      const { data } = await WorkflowResource.getWorkflows2({
        client,
        path: { name, correlationId },
        query: { includeClosed, includeTasks },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    retry1: async (workflowId: string, resumeSubworkflowTasks = false) => {
      warn();
      await WorkflowResource.retry({
        client,
        path: { workflowId },
        query: { resumeSubworkflowTasks },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getExecutionStatus: async (workflowId: string, includeTasks = true) => {
      warn();
      const { data } = await WorkflowResource.getExecutionStatus({
        client,
        path: { workflowId },
        query: { includeTasks },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    terminate1: async (workflowId: string, reason?: string) => {
      warn();
      await WorkflowResource.terminate1({
        client,
        path: { workflowId },
        query: { reason },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    resumeWorkflow: async (workflowId: string) => {
      warn();
      await WorkflowResource.resumeWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    delete: async (workflowId: string, archiveWorkflow = true) => {
      warn();
      await WorkflowResource.delete1({
        client,
        path: { workflowId },
        query: { archiveWorkflow },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    searchWorkflowsByTasks: async (
      start?: number,
      size = 100,
      sort?: string,
      freeText = "*",
      query?: string
    ) => {
      warn();
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
    /**
     * @deprecated
     */
    getExternalStorageLocation: async (
      path: string,
      operation: string,
      payloadType: string
    ) => {
      warn();
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
    /**
     * @deprecated
     */
    startWorkflow1: async (
      name: string,
      requestBody: any,
      version?: number,
      correlationId?: string,
      priority?: number
    ) => {
      warn();
      const { data } = await WorkflowResource.startWorkflow1({
        client,
        path: { name },
        query: { version, correlationId, priority },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    restart1: async (workflowId: string, useLatestDefinitions = false) => {
      warn();
      await WorkflowResource.restart({
        client,
        path: { workflowId },
        query: { useLatestDefinitions },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    search1: async (
      queryId?: string,
      start?: number,
      size = 100,
      sort?: string,
      freeText = "*",
      query?: string,
      skipCache = false
    ) => {
      warn();
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
    /**
     * @deprecated
     */
    searchWorkflowsByTasksV2: async (
      start?: number,
      size = 100,
      sort?: string,
      freeText = "*",
      query?: string
    ) => {
      warn();
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
    /**
     * @deprecated
     */
    resetWorkflow: async (workflowId: string) => {
      warn();
      await WorkflowResource.resetWorkflow({
        client,
        path: { workflowId },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    testWorkflow: async (requestBody: any) => {
      warn();
      const { data } = await WorkflowResource.testWorkflow({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
  };

  const serviceRegistryResource = {
    getRegisteredServices: async () => {
      warn();
      const { data } = await ServiceRegistryResource.getRegisteredServices({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    removeService: async (name: string) => {
      warn();
      await ServiceRegistryResource.removeService({
        client,
        path: { name },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getService: async (name: string) => {
      warn();
      const { data } = await ServiceRegistryResource.getService({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    openCircuitBreaker: async (name: string) => {
      warn();
      const { data } = await ServiceRegistryResource.openCircuitBreaker({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    closeCircuitBreaker: async (name: string) => {
      warn();
      const { data } = await ServiceRegistryResource.closeCircuitBreaker({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    getCircuitBreakerStatus: async (name: string) => {
      warn();
      const { data } = await ServiceRegistryResource.getCircuitBreakerStatus({
        client,
        path: { name },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    addOrUpdateService: async (serviceRegistry: any) => {
      warn();
      await ServiceRegistryResource.addOrUpdateService({
        client,
        body: serviceRegistry,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    addOrUpdateServiceMethod: async (registryName: string, method: any) => {
      warn();
      await ServiceRegistryResource.addOrUpdateMethod({
        client,
        path: { registryName },
        body: method,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    removeMethod: async (
      registryName: string,
      serviceName: string,
      method: string,
      methodType: string
    ) => {
      warn();
      await ServiceRegistryResource.removeMethod({
        client,
        path: { registryName },
        query: { serviceName, method, methodType },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getProtoData: async (registryName: string, filename: string) => {
      warn();
      const { data } = await ServiceRegistryResource.getProtoData({
        client,
        path: { registryName, filename },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    setProtoData: async (registryName: string, filename: string, data: any) => {
      warn();
      await ServiceRegistryResource.setProtoData({
        client,
        path: { registryName, filename },
        body: data,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    deleteProto: async (registryName: string, filename: string) => {
      warn();
      await ServiceRegistryResource.deleteProto({
        client,
        path: { registryName, filename },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getAllProtos: async (registryName: string) => {
      warn();
      const { data } = await ServiceRegistryResource.getAllProtos({
        client,
        path: { registryName },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    discover: async (name: string, create = false) => {
      warn();
      const { data } = await ServiceRegistryResource.discover({
        client,
        path: { name },
        query: { create },
        throwOnError: true,
      });
      return data;
    },
  };

  const humanTaskResource = {
    getConductorTaskById: async (taskId: string) => {
      warn();
      const { data } = await HumanTaskResource.getConductorTaskById({
        client,
        path: { taskId },
        throwOnError: true,
      });
      return data;
    },
  };
  const humanTask = {
    deleteTaskFromHumanTaskRecords: async (requestBody: any[]) => {
      warn();
      await HumanTask.deleteTaskFromHumanTaskRecords({
        client,
        body: requestBody,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    deleteTaskFromHumanTaskRecords1: async (taskId: string) => {
      warn();
      await HumanTask.deleteTaskFromHumanTaskRecords1({
        client,
        path: { taskId },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    search: async (requestBody: any) => {
      warn();
      const { data } = await HumanTask.search({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    updateTaskOutputByRef: async (
      workflowId: string,
      taskRefName: string,
      requestBody: any,
      complete = false,
      iteration?: any[]
    ) => {
      warn();
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
    /**
     * @deprecated
     */
    getTask1: async (taskId: string) => {
      warn();
      const { data } = await HumanTask.getTask1({
        client,
        path: { taskId },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    claimTask: async (
      taskId: string,
      overrideAssignment = false,
      withTemplate = false
    ) => {
      warn();
      const { data } = await HumanTask.claimTask({
        client,
        path: { taskId },
        query: { overrideAssignment, withTemplate },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    assignAndClaim: async (
      taskId: string,
      userId: string,
      overrideAssignment = false,
      withTemplate = false
    ) => {
      warn();
      const { data } = await HumanTask.assignAndClaim({
        client,
        path: { taskId, userId },
        query: { overrideAssignment, withTemplate },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    reassignTask: async (taskId: string, requestBody: any[]) => {
      warn();
      await HumanTask.reassignTask({
        client,
        path: { taskId },
        body: requestBody,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    releaseTask: async (taskId: string) => {
      warn();
      await HumanTask.releaseTask({
        client,
        path: { taskId },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    skipTask: async (taskId: string, reason?: string) => {
      warn();
      await HumanTask.skipTask({
        client,
        path: { taskId },
        query: { reason },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    updateTaskOutput: async (
      taskId: string,
      requestBody: any,
      complete = false
    ) => {
      warn();
      await HumanTask.updateTaskOutput({
        client,
        path: { taskId },
        query: { complete },
        body: requestBody,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getAllTemplates: async (name?: string, version?: number) => {
      warn();
      const { data } = await UserForm.getAllTemplates({
        client,
        query: { name, version },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    saveTemplate: async (requestBody: any, newVersion = false) => {
      warn();
      const { data } = await UserForm.saveTemplate({
        client,
        query: { newVersion },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    saveTemplates: async (requestBody: any[], newVersion = false) => {
      warn();
      const { data } = await UserForm.saveTemplates({
        client,
        query: { newVersion },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    deleteTemplateByName: async (name: string) => {
      warn();
      await UserForm.deleteTemplateByName({
        client,
        path: { name },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    deleteTemplatesByNameAndVersion: async (name: string, version: number) => {
      warn();
      await HumanTask.deleteTemplatesByNameAndVersion({
        client,
        path: { name, version },
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getTemplateByNameAndVersion: async (name: string, version: number) => {
      warn();
      const { data } = await UserForm.getTemplateByNameAndVersion({
        client,
        path: { name, version },
        throwOnError: true,
      });
      return data;
    },
  };

  const taskResource = {
    poll: async (tasktype: string, workerid?: string, domain?: string) => {
      warn();
      const { data } = await TaskResource.poll({
        client,
        path: { tasktype },
        query: { workerid, domain },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    allVerbose: async () => {
      warn();
      const { data } = await TaskResource.allVerbose({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
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
      warn();
      const { data } = await TaskResource.updateTask1({
        client,
        path: { workflowId, taskRefName, status },
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    getTask: async (taskId: string) => {
      warn();
      const { data } = await TaskResource.getTask({
        client,
        path: { taskId },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    all: async () => {
      warn();
      const { data } = await TaskResource.all({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    requeuePendingTask: async (taskType: string) => {
      warn();
      const { data } = await TaskResource.requeuePendingTask({
        client,
        path: { taskType },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    search: async (
      start?: number,
      size = 100,
      sort?: string,
      freeText = "*",
      query?: string
    ) => {
      warn();
      const { data } = await TaskResource.search2({
        client,
        query: { start, size, sort, freeText, query },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    searchV22: async (
      start?: number,
      size = 100,
      sort?: string,
      freeText = "*",
      query?: string
    ) => {
      warn();
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
    /**
     * @deprecated
     */
    getPollData: async (taskType: string) => {
      warn();
      const { data } = await TaskResource.getPollData({
        client,
        query: { taskType },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    getTaskLogs: async (taskId: string) => {
      warn();
      const { data } = await TaskResource.getTaskLogs({
        client,
        path: { taskId },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    log: async (taskId: string, requestBody: string) => {
      warn();
      await TaskResource.log({
        client,
        path: { taskId },
        body: requestBody,
        throwOnError: true,
      });
    },
    /**
     * @deprecated
     */
    getAllPollData: async () => {
      warn();
      const { data } = await TaskResource.getAllPollData({
        client,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    batchPoll: async (
      tasktype: string,
      workerid?: string,
      domain?: string,
      count = 1,
      timeout = 100
    ) => {
      warn();
      const { data } = await TaskResource.batchPoll({
        client,
        path: { tasktype },
        query: { workerid, domain, count, timeout },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    updateTask1: async (requestBody: any) => {
      warn();
      const { data } = await TaskResource.updateTask({
        client,
        body: requestBody,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    size1: async (taskType?: string[]) => {
      warn();
      const { data } = await TaskResource.size({
        client,
        query: { taskType },
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    getExternalStorageLocation1: async (
      path: string,
      operation: string,
      payloadType: string
    ) => {
      warn();
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
    /**
     * @deprecated
     */
    updateTaskSync: async (
      workflowId: string,
      taskRefName: string,
      status: any,
      output: any,
      workerId?: string
    ) => {
      warn();
      const { data } = await TaskResource.updateTaskSync({
        client,
        path: { workflowId, taskRefName, status },
        query: { workerid: workerId },
        body: output,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    signal: async (
      workflowId: string,
      status: any,
      output: any,
      returnStrategy: any = "TARGET_WORKFLOW"
    ) => {
      warn();
      const { data } = await TaskResource.signalWorkflowTaskSync({
        client,
        path: { workflowId, status },
        query: { returnStrategy },
        body: output,
        throwOnError: true,
      });
      return data;
    },
    /**
     * @deprecated
     */
    signalAsync: async (workflowId: string, status: any, output: any) => {
      warn();
      const { data } = await TaskResource.signalWorkflowTaskASync({
        client,
        path: { workflowId, status },
        body: output,
        throwOnError: true,
      });
      return data as SignalResponse;
    },
  };

  return {
    ...client,
    eventResource,
    healthCheckResource,
    metadataResource,
    schedulerResource,
    tokenResource,
    workflowBulkResource,
    workflowResource,
    serviceRegistryResource,
    humanTaskResource,
    humanTask,
    taskResource,
  };
};
