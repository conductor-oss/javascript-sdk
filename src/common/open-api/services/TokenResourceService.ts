/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GenerateTokenRequest } from '../models/GenerateTokenRequest';
import type { Response } from '../models/Response';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TokenResourceService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Generate JWT with the given access key
   * @param requestBody
   * @returns Response OK
   * @throws ApiError
   */
  public generateToken(
    requestBody: GenerateTokenRequest,
  ): CancelablePromise<Response> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/token',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Get the user info from the token
   * @param claims
   * @returns any OK
   * @throws ApiError
   */
  public getUserInfo(
    claims: boolean = false,
  ): CancelablePromise<Record<string, any>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/token/userInfo',
      query: {
        'claims': claims,
      },
    });
  }
}
