/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Tag = {
  key?: string;
  /**
   * @deprecated
   */
  type?: string;
  value?: string;
};

 /**
   * Delete a tag for event handler
   * @param name
   * @param requestBody
   * @returns any OK
   * @throws ApiError
   */
 public deleteTagForEventHandler(
  name: string,
  requestBody: Array<Tag>,
): CancelablePromise<any> {
  return this.httpRequest.request({
    method: 'DELETE',
    url: '/api/event/{name}/tags',
    path: {
      'name': name,
    },
    body: requestBody,
    mediaType: 'application/json',
  });
}
/**
 * Get tags by event handler
 * @param name
 * @returns Tag OK
 * @throws ApiError
 */
public getTagsForEventHandler(
  name: string,
): CancelablePromise<Array<Tag>> {
  return this.httpRequest.request({
    method: 'GET',
    url: '/api/event/{name}/tags',
    path: {
      'name': name,
    },
  });
}
/**
 * Put a tag to event handler
 * @param name
 * @param requestBody
 * @returns any OK
 * @throws ApiError
 */
public putTagForEventHandler(
  name: string,
  requestBody: Array<Tag>,
): CancelablePromise<any> {
  return this.httpRequest.request({
    method: 'PUT',
    url: '/api/event/{name}/tags',
    path: {
      'name': name,
    },
    body: requestBody,
    mediaType: 'application/json',
  });
}
