/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthorizationRequest } from '../models/AuthorizationRequest';
import type { Response } from '../models/Response';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AuthorizationResourceService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Remove user's access over the target
   * @param requestBody
   * @returns Response OK
   * @throws ApiError
   */
  public removePermissions(
    requestBody: AuthorizationRequest,
  ): CancelablePromise<Response> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/auth/authorization',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Grant access to a user over the target
   * @param requestBody
   * @returns Response OK
   * @throws ApiError
   */
  public grantPermissions(
    requestBody: AuthorizationRequest,
  ): CancelablePromise<Response> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/auth/authorization',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Get the access that have been granted over the given object
   * @param type
   * @param id
   * @returns any OK
   * @throws ApiError
   */
  public getPermissions(
    type: 'WORKFLOW' | 'WORKFLOW_DEF' | 'WORKFLOW_SCHEDULE' | 'EVENT_HANDLER' | 'TASK_DEF' | 'TASK_REF_NAME' | 'TASK_ID' | 'APPLICATION' | 'USER' | 'SECRET_NAME' | 'ENV_VARIABLE' | 'TAG' | 'DOMAIN' | 'INTEGRATION_PROVIDER' | 'INTEGRATION' | 'PROMPT' | 'USER_FORM_TEMPLATE' | 'WEBHOOK',
    id: string,
  ): CancelablePromise<Record<string, any>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/auth/authorization/{type}/{id}',
      path: {
        'type': type,
        'id': id,
      },
    });
  }
}
