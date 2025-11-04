import {
  EventResource,
  EventExecutionResource,
  EventMessageResource,
} from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client";
import { handleSdkError } from "./helpers";
import type {
  EventHandler,
  ExtendedEventExecution,
  EventMessage,
  SearchResultHandledEventResponse,
  Tag,
  ConnectivityTestInput,
  ConnectivityTestResult,
} from "../common";

export class EventClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Get all the event handlers
   * @returns {Promise<EventHandler[]>}
   * @throws {ConductorSdkError}
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
   * @param {EventHandler[]} eventHandlers
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
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
   * @param {EventHandler} eventHandler
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
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
   * @param {EventHandler} eventHandler
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
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
   * @param {Record<string, string>} data
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async handleIncomingEvent(
    data: Record<string, string>
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
   * @param {string} eventHandlerName
   * @returns {Promise<EventHandler>}
   * @throws {ConductorSdkError}
   */
  public async getEventHandlerByName(
    eventHandlerName: string
  ): Promise<EventHandler> {
    try {
      const { response, data } = await EventResource.getEventHandlerByName({
        client: this._client,
        throwOnError: true,
        path: { name: eventHandlerName },
      });

      if (response.headers.get("content-length") === "0") {
        throw new Error("Response is empty");
      }
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get event handler by name ${eventHandlerName}`
      );
    }
  }

  /**
   * Get all queue configs
   * @returns {Promise<Record<string, string>>}
   * @throws {ConductorSdkError}
   */
  public async getAllQueueConfigs(): Promise<{ [key: string]: string }> {
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
   * @param {string} queueType
   * @param {string} queueName
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
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
      handleSdkError(
        error,
        `Failed to delete queue config ${queueType} ${queueName}`
      );
    }
  }

  /**
   * Get queue config
   * @param {string} queueType
   * @param {string} queueName
   * @returns {Promise<Record<string, unknown>>}
   * @throws {ConductorSdkError}
   */
  public async getQueueConfig(
    queueType: string,
    queueName: string
  ): Promise<Record<string, unknown>> {
    try {
      const { data } = await EventResource.getQueueConfig({
        path: { queueType, queueName },
        client: this._client,
        throwOnError: true,
      });

      if (Object.keys(data).length === 0) {
        throw new Error("Response is empty");
      }

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get queue config`);
    }
  }

  /**
   * Get event handlers for a given event
   * @param {string} event
   * @param {boolean} [activeOnly=false] Only return active handlers.
   * @returns {Promise<EventHandler[]>}
   * @throws {ConductorSdkError}
   */
  public async getEventHandlersForEvent(
    event: string,
    activeOnly = false
  ): Promise<EventHandler[]> {
    try {
      const { data } = await EventResource.getEventHandlersForEvent({
        client: this._client,
        throwOnError: true,
        path: { event },
        query: { activeOnly },
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get event handlers for event: ${event}`);
    }
  }

  /**
   * Remove an event handler by name
   * @param {string} name
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async removeEventHandler(name: string): Promise<void> {
    try {
      await EventResource.removeEventHandlerStatus({
        client: this._client,
        throwOnError: true,
        path: { name },
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to remove event handler: ${name}`);
    }
  }

  /**
   * Get tags for an event handler
   * @param {string} name
   * @returns {Promise<Tag[]>}
   * @throws {ConductorSdkError}
   */
  public async getTagsForEventHandler(name: string): Promise<Tag[]> {
    try {
      const { data } = await EventResource.getTagsForEventHandler({
        client: this._client,
        throwOnError: true,
        path: { name },
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get tags for event handler: ${name}`);
    }
  }

  /**
   * Put tags for an event handler
   * @param {string} name
   * @param {Tag[]} tags
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async putTagForEventHandler(name: string, tags: Tag[]): Promise<void> {
    try {
      await EventResource.putTagForEventHandler({
        client: this._client,
        throwOnError: true,
        path: { name },
        body: tags,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to put tags for event handler: ${name}`);
    }
  }

  /**
   * Delete tags for an event handler
   * @param {string} name
   * @param {Tag[]} tags
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async deleteTagsForEventHandler(
    name: string,
    tags: Tag[]
  ): Promise<void> {
    try {
      await EventResource.deleteTagForEventHandler({
        client: this._client,
        throwOnError: true,
        path: { name },
        body: tags,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete tags for an event handler: ${name}`
      );
    }
  }

  /**
   * Delete a tag for an event handler
   * @param {string} name
   * @param {Tag} tag
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async deleteTagForEventHandler(name: string, tag: Tag): Promise<void> {
    try {
      await EventResource.deleteTagForEventHandler({
        client: this._client,
        throwOnError: true,
        path: { name },
        body: [tag],
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete a tag for an event handler: ${name}`
      );
    }
  }

  /**
   * Test connectivity for a given queue using a workflow with EVENT task and an EventHandler
   * @param {ConnectivityTestInput} input
   * @returns {Promise<ConnectivityTestResult>}
   * @throws {ConductorSdkError}
   */
  public async testConnectivity(
    input: ConnectivityTestInput
  ): Promise<ConnectivityTestResult> {
    try {
      const { data } = await EventResource.testConnectivity({
        client: this._client,
        throwOnError: true,
        body: input,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to test connectivity`);
    }
  }

  /**
   * Create or update queue config by name
   * @deprecated Prefer server's newer endpoints if available
   * @param {string} queueType
   * @param {string} queueName
   * @param {string} config
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async putQueueConfig(
    queueType: string,
    queueName: string,
    config: string
  ): Promise<void> {
    try {
      await EventResource.putQueueConfig({
        client: this._client,
        throwOnError: true,
        path: { queueType, queueName },
        body: config,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to put queue config`);
    }
  }

  /**
   * Test endpoint (as exposed by API)
   * @returns {Promise<EventHandler>}
   * @throws {ConductorSdkError}
   */
  public async test(): Promise<EventHandler> {
    try {
      const { data } = await EventResource.test({
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to call test endpoint`);
    }
  }

  /**
   * Get all active event handlers (execution view)
   * @returns {Promise<SearchResultHandledEventResponse>}
   * @throws {ConductorSdkError}
   */
  public async getAllActiveEventHandlers(): Promise<SearchResultHandledEventResponse> {
    try {
      const { data } = await EventExecutionResource.getEventHandlersForEvent1({
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get all active event handlers (execution view)`
      );
    }
  }

  /**
   * Get event executions for a specific handler
   * @param {string} eventHandlerName
   * @param {number} [from] Pagination cursor
   * @returns {Promise<ExtendedEventExecution[]>}
   * @throws {ConductorSdkError}
   */
  public async getEventExecutions(
    eventHandlerName: string,
    from?: number
  ): Promise<ExtendedEventExecution[]> {
    try {
      const { data } = await EventExecutionResource.getEventHandlersForEvent2({
        client: this._client,
        throwOnError: true,
        path: { eventHandlerName },
        query: { from },
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get event executions for handler: ${eventHandlerName}`
      );
    }
  }

  /**
   * Get all event handlers with statistics (messages view)
   * @param {number} [from] Pagination cursor
   * @returns {Promise<SearchResultHandledEventResponse>}
   * @throws {ConductorSdkError}
   */
  public async getEventHandlersWithStats(
    from?: number
  ): Promise<SearchResultHandledEventResponse> {
    try {
      const { data } = await EventMessageResource.getEvents({
        client: this._client,
        throwOnError: true,
        query: { from },
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get event handlers statistics`);
    }
  }

  /**
   * Get event messages for a given event
   * @param {string} event
   * @param {number} [from] Pagination cursor
   * @returns {Promise<EventMessage[]>}
   * @throws {ConductorSdkError}
   */
  public async getEventMessages(
    event: string,
    from?: number
  ): Promise<EventMessage[]> {
    try {
      const { data } = await EventMessageResource.getMessages({
        client: this._client,
        throwOnError: true,
        path: { event },
        query: { from },
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get event messages for event: ${event}`);
    }
  }
}
