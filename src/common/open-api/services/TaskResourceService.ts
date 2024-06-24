/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PollData } from '../models/PollData';
import type { SearchResultTaskSummary } from '../models/SearchResultTaskSummary';
import type { Task } from '../models/Task';
import type { TaskExecLog } from '../models/TaskExecLog';
import type { TaskResult } from '../models/TaskResult';
import type { Workflow } from '../models/Workflow';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TaskResourceService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Update a task
   * @param requestBody
   * @returns string OK
   * @throws ApiError
   */
  public updateTask(
    requestBody: TaskResult,
  ): CancelablePromise<string> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/tasks',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Batch poll for a task of a certain type
   * @param tasktype
   * @param workerid
   * @param domain
   * @param count
   * @param timeout
   * @returns Task OK
   * @throws ApiError
   */
  public batchPoll(
    tasktype: string,
    workerid?: string,
    domain?: string,
    count: number = 1,
    timeout: number = 100,
  ): CancelablePromise<Array<Task>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/poll/batch/{tasktype}',
      path: {
        'tasktype': tasktype,
      },
      query: {
        'workerid': workerid,
        'domain': domain,
        'count': count,
        'timeout': timeout,
      },
    });
  }
  /**
   * Poll for a task of a certain type
   * @param tasktype
   * @param workerid
   * @param domain
   * @returns Task OK
   * @throws ApiError
   */
  public poll(
    tasktype: string,
    workerid?: string,
    domain?: string,
  ): CancelablePromise<Task> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/poll/{tasktype}',
      path: {
        'tasktype': tasktype,
      },
      query: {
        'workerid': workerid,
        'domain': domain,
      },
    });
  }
  /**
   * Get the details about each queue
   * @returns number OK
   * @throws ApiError
   */
  public all(): CancelablePromise<Record<string, number>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/queue/all',
    });
  }
  /**
   * Get the details about each queue
   * @returns number OK
   * @throws ApiError
   */
  public allVerbose(): CancelablePromise<Record<string, Record<string, Record<string, number>>>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/queue/all/verbose',
    });
  }
  /**
   * Get the last poll data for a given task type
   * @param taskType
   * @returns PollData OK
   * @throws ApiError
   */
  public getPollData(
    taskType: string,
  ): CancelablePromise<Array<PollData>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/queue/polldata',
      query: {
        'taskType': taskType,
      },
    });
  }
  /**
   * Get the last poll data for all task types
   * @param workerSize
   * @param workerOpt
   * @param queueSize
   * @param queueOpt
   * @param lastPollTimeSize
   * @param lastPollTimeOpt
   * @returns any OK
   * @throws ApiError
   */
  public getAllPollData(
    workerSize?: number,
    workerOpt?: 'GT' | 'LT',
    queueSize?: number,
    queueOpt?: 'GT' | 'LT',
    lastPollTimeSize?: number,
    lastPollTimeOpt?: 'GT' | 'LT',
  ): CancelablePromise<Record<string, Record<string, any>>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/queue/polldata/all',
      query: {
        'workerSize': workerSize,
        'workerOpt': workerOpt,
        'queueSize': queueSize,
        'queueOpt': queueOpt,
        'lastPollTimeSize': lastPollTimeSize,
        'lastPollTimeOpt': lastPollTimeOpt,
      },
    });
  }
  /**
   * Requeue pending tasks
   * @param taskType
   * @returns string OK
   * @throws ApiError
   */
  public requeuePendingTask(
    taskType: string,
  ): CancelablePromise<string> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/tasks/queue/requeue/{taskType}',
      path: {
        'taskType': taskType,
      },
    });
  }
  /**
   * Get Task type queue sizes
   * @param taskType
   * @returns number OK
   * @throws ApiError
   */
  public size(
    taskType?: Array<string>,
  ): CancelablePromise<Record<string, number>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/queue/sizes',
      query: {
        'taskType': taskType,
      },
    });
  }
  /**
   * Search for tasks based in payload and other parameters
   * use sort options as sort=<field>:ASC|DESC e.g. sort=name&sort=workflowId:DESC. If order is not specified, defaults to ASC
   * @param start
   * @param size
   * @param sort
   * @param freeText
   * @param query
   * @returns SearchResultTaskSummary OK
   * @throws ApiError
   */
  public search(
    start?: number,
    size: number = 100,
    sort?: string,
    freeText: string = '*',
    query?: string,
  ): CancelablePromise<SearchResultTaskSummary> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/search',
      query: {
        'start': start,
        'size': size,
        'sort': sort,
        'freeText': freeText,
        'query': query,
      },
    });
  }
  /**
   * Get task by Id
   * @param taskId
   * @returns Task OK
   * @throws ApiError
   */
  public getTask(
    taskId: string,
  ): CancelablePromise<Task> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/{taskId}',
      path: {
        'taskId': taskId,
      },
    });
  }
  /**
   * Get Task Execution Logs
   * @param taskId
   * @returns TaskExecLog OK
   * @throws ApiError
   */
  public getTaskLogs(
    taskId: string,
  ): CancelablePromise<Array<TaskExecLog>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/tasks/{taskId}/log',
      path: {
        'taskId': taskId,
      },
    });
  }
  /**
   * Log Task Execution Details
   * @param taskId
   * @param requestBody
   * @returns any OK
   * @throws ApiError
   */
  public log(
    taskId: string,
    requestBody: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/tasks/{taskId}/log',
      path: {
        'taskId': taskId,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Update a task By Ref Name
   * @param workflowId
   * @param taskRefName
   * @param status
   * @param requestBody
   * @param workerid
   * @returns string OK
   * @throws ApiError
   */
  public updateTask1(
    workflowId: string,
    taskRefName: string,
    status: 'IN_PROGRESS' | 'FAILED' | 'FAILED_WITH_TERMINAL_ERROR' | 'COMPLETED',
    requestBody: Record<string, Record<string, any>>,
    workerid?: string,
  ): CancelablePromise<string> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/tasks/{workflowId}/{taskRefName}/{status}',
      path: {
        'workflowId': workflowId,
        'taskRefName': taskRefName,
        'status': status,
      },
      query: {
        'workerid': workerid,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Update a task By Ref Name synchronously
   * @param workflowId
   * @param taskRefName
   * @param status
   * @param requestBody
   * @param workerid
   * @returns Workflow OK
   * @throws ApiError
   */
  public updateTaskSync(
    workflowId: string,
    taskRefName: string,
    status: 'IN_PROGRESS' | 'FAILED' | 'FAILED_WITH_TERMINAL_ERROR' | 'COMPLETED',
    requestBody: Record<string, Record<string, any>>,
    workerid?: string,
  ): CancelablePromise<Workflow> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/tasks/{workflowId}/{taskRefName}/{status}/sync',
      path: {
        'workflowId': workflowId,
        'taskRefName': taskRefName,
        'status': status,
      },
      query: {
        'workerid': workerid,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
}
