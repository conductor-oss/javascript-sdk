import { EventResource } from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client";
import { handleSdkError } from "./helpers";
import type { EventHandler } from "../common";
import {
  GetQueueNamesResponses,
  HandleIncomingEventData,
} from "../common/open-api/types.gen";

export class EventClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Get all the event handlers
   *
   * @returns
   */
  public async getAllEventHandlers(): Promise<EventHandler[]> {
    try {
      const { data } = await EventResource.getEventHandlers({
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get all event handlers`);
    }
  }

  /**
   * Add event handlers
   *
   * @param eventHandlers
   * @returns
   */
  public async addEventHandlers(eventHandlers: EventHandler[]): Promise<void> {
    try {
      await EventResource.addEventHandler({
        body: eventHandlers,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to add event handlers`);
    }
  }

  /**
   * Add an event handler
   *
   * @param eventHandler
   * @returns
   */
  public async addEventHandler(eventHandler: EventHandler): Promise<void> {
    try {
      await EventResource.addEventHandler({
        body: [eventHandler],
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to add event handler`);
    }
  }

  /**
   * Update an event handler
   *
   * @param eventHandler
   * @returns
   */
  public async updateEventHandler(eventHandler: EventHandler): Promise<void> {
    try {
      await EventResource.updateEventHandler({
        body: eventHandler,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to update event handler`);
    }
  }

  /**
   * Handle an incoming event
   *
   * @param data
   * @returns
   */
  public async handleIncomingEvent(
    data: { [key: string]: string } // TODO: add better data type after openapi spec update?
  ): Promise<void> {
    try {
      await EventResource.handleIncomingEvent({
        body: data,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to handle incoming event`);
    }
  }

  /**
   * Get an event handler by name
   *
   * @param eventHandlerName
   * @returns
   */
  public async getEventHandlerByName(
    eventHandlerName: string
  ): Promise<EventHandler> {
    try {
      const { data } = await EventResource.getEventHandlerByName({
        client: this._client,
        throwOnError: true,
        path: { name: eventHandlerName },
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get event handler by name`);
    }
  }

  /**
   * Get all queue configs
   *
   * @returns
   */
  public async getAllQueueConfigs(): Promise<{ [key: string]: string }> {
    // TODO: add better return type after openapi spec update?
    try {
      const { data } = await EventResource.getQueueNames({
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get all queue configs`);
    }
  }

  /**
   * Delete queue config
   *
   * @param queueType
   * @param queueName
   * @returns
   */
  public async deleteQueueConfig(
    queueType: string,
    queueName: string
  ): Promise<void> {
    try {
      await EventResource.deleteQueueConfig({
        path: { queueType, queueName },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete queue config`);
    }
  }

  /**
   * Get queue config
   *
   * @param queueType
   * @param queueName
   * @returns
   */
  public async getQueueConfig(
    queueType: string,
    queueName: string
  ): Promise<{ [key: string]: unknown }> {
    // TODO: add better return type after openapi spec update?
    try {
      const { data } = await EventResource.getQueueConfig({
        path: { queueType, queueName },
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get queue config`);
    }
  }
}
