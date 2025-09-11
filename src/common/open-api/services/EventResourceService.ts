/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EventHandler } from '../models/EventHandler';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
import { Tag } from '../models/Tag';

export class EventResourceService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get queue config by name
   * @param queueType
   * @param queueName
   * @returns any OK
   * @throws ApiError
   */
  public getQueueConfig(
    queueType: string,
    queueName: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/event/queue/config/{queueType}/{queueName}',
      path: {
        'queueType': queueType,
        'queueName': queueName,
      },
    });
  }

  /**
   * Create or update queue config by name
   * @param queueType
   * @param queueName
   * @param requestBody
   * @returns any OK
   * @throws ApiError
   */
  public putQueueConfig(
    queueType: string,
    queueName: string,
    requestBody: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/event/queue/config/{queueType}/{queueName}',
      path: {
        'queueType': queueType,
        'queueName': queueName,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * Delete queue config by name
   * @param queueType
   * @param queueName
   * @returns any OK
   * @throws ApiError
   */
  public deleteQueueConfig(
    queueType: string,
    queueName: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/event/queue/config/{queueType}/{queueName}',
      path: {
        'queueType': queueType,
        'queueName': queueName,
      },
    });
  }

  /**
   * Get all the event handlers
   * @returns EventHandler OK
   * @throws ApiError
   */
  public getEventHandlers(): CancelablePromise<Array<EventHandler>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/event',
    });
  }

  /**
   * Update an existing event handler.
   * @param requestBody
   * @returns any OK
   * @throws ApiError
   */
  public updateEventHandler(
    requestBody: EventHandler,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/event',
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * Add a new event handler.
   * @param requestBody
   * @returns any OK
   * @throws ApiError
   */
  public addEventHandler(
    requestBody: EventHandler,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/event',
      body: requestBody,
      mediaType: 'application/json',
    });
  }

  /**
   * Get all queue configs
   * @returns any OK
   * @throws ApiError
   */
  public getQueueNames(): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/event/queue/config',
    });
  }

  /**
   * Remove an event handler
   * @param name
   * @returns any OK
   * @throws ApiError
   */
  public removeEventHandlerStatus(
    name: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/event/{name}',
      path: {
        'name': name,
      },
    });
  }

  /**
   * Get event handlers for a given event
   * @param event
   * @param activeOnly
   * @returns EventHandler OK
   * @throws ApiError
   */
  public getEventHandlersForEvent(
    event: string,
    activeOnly: boolean = true,
  ): CancelablePromise<Array<EventHandler>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/event/{event}',
      path: {
        'event': event,
      },
      query: {
        'activeOnly': activeOnly,
      },
    });
  }

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
      url: '/event/{name}/tags',
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
      url: '/event/{name}/tags',
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
      url: '/event/{name}/tags',
      path: {
        'name': name,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
}
