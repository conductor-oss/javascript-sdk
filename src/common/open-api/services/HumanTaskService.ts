/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HumanTaskAssignment } from "../models/HumanTaskAssignment";
import type { HumanTaskEntry } from "../models/HumanTaskEntry";
import type { HumanTaskSearch } from "../models/HumanTaskSearch";
import type { HumanTaskSearchResult } from "../models/HumanTaskSearchResult";
import type { HumanTaskTemplate } from "../models/HumanTaskTemplate";

import type { CancelablePromise } from "../core/CancelablePromise";
import type { BaseHttpRequest } from "../core/BaseHttpRequest";

export class HumanTaskService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * If the workflow is disconnected from tasks, this API can be used to clean up (in bulk)
   * @param requestBody
   * @returns any OK
   * @throws ApiError
   */
  public deleteTaskFromHumanTaskRecords(
    requestBody: Array<string>,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/human/tasks/delete',
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * If the workflow is disconnected from tasks, this API can be used to clean up
   * @param taskId
   * @returns any OK
   * @throws ApiError
   */
  public deleteTaskFromHumanTaskRecords1(
    taskId: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/human/tasks/delete/{taskId}',
      path: {
        'taskId': taskId,
      },
    });
  }

  /**
   * Search human tasks
   * @param requestBody
   * @returns HumanTaskSearchResult OK
   * @throws ApiError
   */
  public search(
    requestBody: HumanTaskSearch,
  ): CancelablePromise<HumanTaskSearchResult> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/tasks/search',
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * Update task output, optionally complete
   * @param workflowId
   * @param taskRefName
   * @param requestBody
   * @param complete
   * @param iteration Populate this value if your task is in a loop and you want to update a specific iteration. If its not in a loop OR if you want to just update the latest iteration, leave this as empty
   * @returns any OK
   * @throws ApiError
   */
  public updateTaskOutputByRef(
    workflowId: string,
    taskRefName: string,
    requestBody: Record<string, any>,
    complete: boolean = false,
    iteration?: Array<number>,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/tasks/update/taskRef',
      query: {
        'workflowId': workflowId,
        'taskRefName': taskRefName,
        'complete': complete,
        'iteration': iteration,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * Get a task
   * @param taskId
   * @returns HumanTaskEntry OK
   * @throws ApiError
   */
  public getTask1(
    taskId: string,
    withTemplate: boolean = false
  ): CancelablePromise<HumanTaskEntry> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/human/tasks/{taskId}',
      path: {
        taskId: taskId,
      },
      query: {
        withTemplate,
      },
    });
  }

  /**
   * Claim a task by authenticated Conductor user
   * @param taskId
   * @param overrideAssignment
   * @returns any OK
   * @throws ApiError
   */
  public claimTask(
    taskId: string,
    overrideAssignment: boolean = false,
    withTemplate: boolean = false,
  ): CancelablePromise<HumanTaskEntry> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/tasks/{taskId}/claim',
      path: {
        'taskId': taskId,
      },
      query: {
        'overrideAssignment': overrideAssignment,
        'withTemplate':withTemplate,
      },
    });
  }

  /**
   * Claim a task to an external user
   * @param taskId
   * @param userId
   * @param overrideAssignment
   * @returns any OK
   * @throws ApiError
   */
  public assignAndClaim(
    taskId: string,
    userId: string,
    overrideAssignment: boolean = false,
    withTemplate: boolean = false,
  ): CancelablePromise<HumanTaskEntry> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/tasks/{taskId}/externalUser/{userId}',
      path: {
        'taskId': taskId,
        'userId': userId,
      },
      query: {
        'overrideAssignment': overrideAssignment,
        'withTemplate':withTemplate,
      },
    });
  }

  /**
   * Release a task without completing it
   * @param taskId
   * @param requestBody
   * @returns any OK
   * @throws ApiError
   */
  public reassignTask(
    taskId: string,
    requestBody: Array<HumanTaskAssignment>,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/tasks/{taskId}/reassign',
      path: {
        'taskId': taskId,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * Release a task without completing it
   * @param taskId
   * @returns any OK
   * @throws ApiError
   */
  public releaseTask(
    taskId: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/tasks/{taskId}/release',
      path: {
        'taskId': taskId,
      },
    });
  }

  /**
   * If a task is assigned to a user, this API can be used to skip that assignment and move to the next assignee
   * @param taskId
   * @param reason
   * @returns any OK
   * @throws ApiError
   */
  public skipTask(
    taskId: string,
    reason?: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/tasks/{taskId}/skip',
      path: {
        'taskId': taskId,
      },
      query: {
        'reason': reason,
      },
    });
  }

  /**
   * Update task output, optionally complete
   * @param taskId
   * @param requestBody
   * @param complete
   * @returns any OK
   * @throws ApiError
   */
  public updateTaskOutput(
    taskId: string,
    requestBody: Record<string, any>,
    complete: boolean = false,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/human/tasks/{taskId}/update",
      path: {
        'taskId': taskId,
      },
      query: {
        'complete': complete,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * List all user form templates or get templates by name, or a template by name and version
   * @param name
   * @param version
   * @returns HumanTaskTemplate OK
   * @throws ApiError
   */
  public getAllTemplates(
    name?: string,
    version?: number,
  ): CancelablePromise<Array<HumanTaskTemplate>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/human/template',
      query: {
        'name': name,
        'version': version,
      },
    });
  }

  /**
   * Save user form template
   * @param requestBody
   * @param newVersion
   * @returns HumanTaskTemplate OK
   * @throws ApiError
   */
  public saveTemplate(
    requestBody: HumanTaskTemplate,
    newVersion: boolean = false,
  ): CancelablePromise<HumanTaskTemplate> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/template',
      query: {
        'newVersion': newVersion,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * Save user form template
   * @param requestBody
   * @param newVersion
   * @returns HumanTaskTemplate OK
   * @throws ApiError
   */
  public saveTemplates(
    requestBody: Array<HumanTaskTemplate>,
    newVersion: boolean = false,
  ): CancelablePromise<Array<HumanTaskTemplate>> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/human/template/bulk',
      query: {
        'newVersion': newVersion,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * Delete all versions of user form template by name
   * @param name
   * @returns any OK
   * @throws ApiError
   */
  public deleteTemplateByName(
    name: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/human/template/{name}',
      path: {
        'name': name,
      },
    });
  }

  /**
   * Delete a version of form template by name
   * @param name
   * @param version
   * @returns any OK
   * @throws ApiError
   */
  public deleteTemplatesByNameAndVersion(
    name: string,
    version: number,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/human/template/{name}/{version}',
      path: {
        'name': name,
        'version': version,
      },
    });
  }

  /**
   * Get user form template by name and version
   * @param name
   * @param version
   * @returns HumanTaskTemplate OK
   * @throws ApiError
   */
  public getTemplateByNameAndVersion(
    name: string,
    version: number,
  ): CancelablePromise<HumanTaskTemplate> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/human/template/{name}/{version}',
      path: {
        'name': name,
        'version': version,
      },
    });
  }

}
