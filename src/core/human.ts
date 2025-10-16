import { HumanTaskSearch, HumanTaskEntry, HumanTaskTemplate } from "../common";
import { HumanTask } from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client/types.gen";
import { errorMapper } from "./helpers";

type UserType =
  | "EXTERNAL_USER"
  | "EXTERNAL_GROUP"
  | "CONDUCTOR_USER"
  | "CONDUCTOR_GROUP";

const EMPTY_SEARCH: HumanTaskSearch = {
  size: 15,
  states: [],
  taskInputQuery: "",
  taskOutputQuery: "",
  definitionNames: [],
  taskRefNames: [],
  claimants: [],
  assignees: [],
  start: 0,
};

const DEFAULT_POLL_INTERVAL = { pollInterval: 100, maxPollTimes: 20 };

interface PollIntervalOptions {
  pollInterval: number;
  maxPollTimes: number;
}
export class HumanExecutor {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * @deprecated use search instead
   * Takes a set of filter parameters. return matches of human tasks for that set of parameters
   * @param state
   * @param assignee
   * @param assigneeType
   * @param claimedBy
   * @param taskName
   * @param freeText
   * @param includeInputOutput
   * @returns
   */
  public async getTasksByFilter(
    state: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "TIMED_OUT",
    assignee?: string,
    assigneeType?:
      | "EXTERNAL_USER"
      | "EXTERNAL_GROUP"
      | "CONDUCTOR_USER"
      | "CONDUCTOR_GROUP",
    claimedBy?: string,
    taskName?: string,
    taskInputQuery?: string,
    taskOutputQuery?: string
  ): Promise<HumanTaskEntry[]> {
    const [claimedUserType, claimedUser] = claimedBy?.split(":") ?? [];

    if (claimedUserType && !claimedUser) {
      throw new Error("claimedBy should be in the format of <userType>:<user>");
    }

    const response = await this.search({
      states: [state],
      assignees: assignee ? [{ userType: assigneeType, user: assignee }] : [],
      claimants: claimedBy
        ? [{ userType: claimedUserType as UserType, user: claimedUser }]
        : [],
      taskRefNames: taskName ? [taskName] : [],
      taskInputQuery,
      taskOutputQuery,
    });

    return response;
  }

  /**
   * Takes a set of filter parameters. return matches of human tasks for that set of parameters
   * @param state
   * @param assignee
   * @param assigneeType
   * @param claimedBy
   * @param taskName
   * @param freeText
   * @param includeInputOutput
   * @returns Promise<HumanTaskEntry[]>
   */
  public async search(
    searchParams: Partial<HumanTaskSearch>
  ): Promise<HumanTaskEntry[]> {
    const search = { ...EMPTY_SEARCH, ...searchParams };
    try {
      const { data } = await HumanTask.search({
        client: this._client,
        body: search,
      });

      if (data?.results != undefined) {
        return data.results;
      }
      return [];
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Takes a set of filter parameters. An polling interval options. will poll until the task returns a result
   * @param state
   * @param assignee
   * @param assigneeType
   * @param claimedBy
   * @param taskName
   * @param freeText
   * @param includeInputOutput
   * @returns Promise<HumanTaskEntry[]>
   */
  public async pollSearch(
    searchParams: Partial<HumanTaskSearch>,
    {
      pollInterval = 100,
      maxPollTimes = 20,
    }: PollIntervalOptions = DEFAULT_POLL_INTERVAL
  ): Promise<HumanTaskEntry[]> {
    try {
      let pollCount = 0;
      while (pollCount < maxPollTimes) {
        const response = await this.search(searchParams);
        if (response.length > 0) {
          return response;
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        pollCount++;
      }
      return [];
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Returns task for a given task id
   * @param taskId
   * @returns
   */
  public async getTaskById(taskId: string): Promise<HumanTaskEntry | undefined> {
    try {
      const { data } = await HumanTask.getTask1({
        client: this._client,
        path: { taskId },
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Assigns taskId to assignee. If the task is already assigned to another user, this will fail.
   * @param taskId
   * @param assignee
   * @returns
   */
  public async claimTaskAsExternalUser(
    taskId: string,
    assignee: string,
    options?: Record<string, boolean>
  ): Promise<HumanTaskEntry | undefined> {
    try {
      const { data } = await HumanTask.assignAndClaim({
        client: this._client,
        path: { taskId, userId: assignee },
        query: {
          overrideAssignment: options?.overrideAssignment,
          withTemplate: options?.withTemplate,
        },
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Claim task as conductor user
   * @param taskId
   * @returns
   */
  public async claimTaskAsConductorUser(
    taskId: string,
    options?: Record<string, boolean>
  ): Promise<HumanTaskEntry | undefined> {
    try {
      const { data } = await HumanTask.claimTask({
        client: this._client,
        path: { taskId },
        query: {
          overrideAssignment: options?.overrideAssignment,
          withTemplate: options?.withTemplate,
        },
      });
      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Claim task as conductor user
   * @param taskId
   * @param assignee
   * @returns
   */
  public async releaseTask(taskId: string) {
    try {
      await HumanTask.releaseTask({
        client: this._client,
        path: { taskId },
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Returns a HumanTaskTemplateEntry for a given name and version
   * @param templateId
   * @returns
   */
  public async getTemplateByNameVersion(
    name: string,
    version: number
  ): Promise<HumanTaskTemplate | undefined> {
    try {
      const { data } = await HumanTask.getTemplateByNameAndVersion({
        client: this._client,
        path: { name, version },
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * @deprecated use getTemplate instead. name will be used as id here with version 1
   * Returns a HumanTaskTemplateEntry for a given templateId
   * @param templateId
   * @returns
   */
  public async getTemplateById(
    templateNameVersionOne: string
  ): Promise<HumanTaskTemplate | undefined> {
    return this.getTemplateByNameVersion(templateNameVersionOne, 1);
  }

  /**
   * Takes a taskId and a partial body. will update with given body
   * @param taskId
   * @param requestBody
   */
  public async updateTaskOutput(
    taskId: string,
    requestBody: Record<string, Record<string, unknown>>
  ): Promise<void> {
    try {
      await HumanTask.updateTaskOutput({
        client: this._client,
        path: { taskId },
        body: requestBody,
        query: { complete: false },
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Takes a taskId and an optional partial body. will complete the task with the given body
   * @param taskId
   * @param requestBody
   */
  public async completeTask(
    taskId: string,
    requestBody: Record<string, Record<string, unknown>> = {}
  ) {
    try {
      await HumanTask.updateTaskOutput({
        client: this._client,
        path: { taskId },
        body: requestBody,
        query: { complete: true },
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }
}
