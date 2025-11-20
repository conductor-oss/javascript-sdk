import { HumanTaskSearch } from "../../../open-api";

export const EMPTY_SEARCH: HumanTaskSearch = {
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

export const DEFAULT_POLL_INTERVAL = { pollInterval: 100, maxPollTimes: 20 };
