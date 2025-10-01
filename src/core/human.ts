import {
  ConductorClient,
  HumanTaskSearch,
  HumanTaskEntry,
  HumanTaskTemplate,
} from "../common";
import { errorMapper, tryCatchReThrow } from "./helpers";

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

type PollIntervalOptions = {
  pollInterval: number;
  maxPollTimes: number;
};

type ClaimOptions = {
  overrideAssignment: boolean;
  withTemplate: boolean;
};
export class HumanExecutor {
  public readonly _client: ConductorClient;

  constructor(client: ConductorClient) {
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
      assignees: assignee ? [{ userType: assigneeType!, user: assignee }] : [],
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
    const response = await tryCatchReThrow(() =>
      this._client.humanTask.search(search)
    );
    if (response.results != undefined) {
      return response.results;
    }
    return [];
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
  }

  /**
   * Returns task for a given task id
   * @param taskId
   * @returns
   */
  public getTaskById(
    taskId: string,
    withTemplate: boolean = false
  ): Promise<HumanTaskEntry> {
    return tryCatchReThrow(() =>
      this._client.humanTask.getTask1(taskId!, withTemplate)
    );
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
    options?: ClaimOptions
  ): Promise<HumanTaskEntry> {
    return tryCatchReThrow(() =>
      this._client.humanTask.assignAndClaim(
        taskId,
        assignee,
        options?.overrideAssignment,
        options?.withTemplate
      )
    );
  }

  /**
   * Claim task as conductor user
   * @param taskId
   * @returns
   */
  public async claimTaskAsConductorUser(
    taskId: string,
    options?: ClaimOptions
  ): Promise<HumanTaskEntry> {
    return tryCatchReThrow(() =>
      this._client.humanTask.claimTask(
        taskId,
        options?.overrideAssignment,
        options?.withTemplate
      )
    );
  }

  /**
   * Claim task as conductor user
   * @param taskId
   * @param assignee
   * @returns
   */
  public async releaseTask(taskId: string) {
    try {
      await this._client.humanTask.releaseTask(taskId);
    } catch (error: any) {
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
  ): Promise<HumanTaskTemplate> {
    return tryCatchReThrow(() =>
      this._client.humanTask.getTemplateByNameAndVersion(name, version)
    );
  }

  /**
   * @deprecated use getTemplate instead. name will be used as id here with version 1
   * Returns a HumanTaskTemplateEntry for a given templateId
   * @param templateId
   * @returns
   */
  public async getTemplateById(
    templateNameVersionOne: string
  ): Promise<HumanTaskTemplate> {
    return this.getTemplateByNameVersion(templateNameVersionOne, 1);
  }

  /**
   * Takes a taskId and a partial body. will update with given body
   * @param taskId
   * @param requestBody
   */
  public async updateTaskOutput(
    taskId: string,
    requestBody: Record<string, Record<string, any>>
  ) {
    try {
      await this._client.humanTask.updateTaskOutput(taskId, requestBody, false);
    } catch (error: any) {
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
    requestBody: Record<string, Record<string, any>> = {}
  ) {
    try {
      await this._client.humanTask.updateTaskOutput(taskId, requestBody, true);
    } catch (error: any) {
      throw errorMapper(error);
    }
  }
}
