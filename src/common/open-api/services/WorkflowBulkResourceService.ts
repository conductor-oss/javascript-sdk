/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BulkResponse } from '../models/BulkResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class WorkflowBulkResourceService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Permanently remove workflows from the system
   * @param requestBody
   * @returns BulkResponse OK
   * @throws ApiError
   */
  public delete(
    requestBody: Array<string>,
  ): CancelablePromise<BulkResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/workflow/bulk/delete',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Pause the list of workflows
   * @param requestBody
   * @returns BulkResponse OK
   * @throws ApiError
   */
  public pauseWorkflow1(
    requestBody: Array<string>,
  ): CancelablePromise<BulkResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/workflow/bulk/pause',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Restart the list of completed workflow
   * @param requestBody
   * @param useLatestDefinitions
   * @returns BulkResponse OK
   * @throws ApiError
   */
  public restart(
    requestBody: Array<string>,
    useLatestDefinitions: boolean = false,
  ): CancelablePromise<BulkResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/workflow/bulk/restart',
      query: {
        'useLatestDefinitions': useLatestDefinitions,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Resume the list of workflows
   * @param requestBody
   * @returns BulkResponse OK
   * @throws ApiError
   */
  public resumeWorkflow1(
    requestBody: Array<string>,
  ): CancelablePromise<BulkResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/workflow/bulk/resume',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Retry the last failed task for each workflow from the list
   * @param requestBody
   * @returns BulkResponse OK
   * @throws ApiError
   */
  public retry1(
    requestBody: Array<string>,
  ): CancelablePromise<BulkResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/workflow/bulk/retry',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Terminate workflows execution
   * @param requestBody
   * @param reason
   * @param triggerFailureWorkflow
   * @returns BulkResponse OK
   * @throws ApiError
   */
  public terminate(
    requestBody: Array<string>,
    reason?: string,
    triggerFailureWorkflow: boolean = false,
  ): CancelablePromise<BulkResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/workflow/bulk/terminate',
      query: {
        'reason': reason,
        'triggerFailureWorkflow': triggerFailureWorkflow,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
}
