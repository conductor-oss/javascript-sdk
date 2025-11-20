export type UserType =
  | "EXTERNAL_USER"
  | "EXTERNAL_GROUP"
  | "CONDUCTOR_USER"
  | "CONDUCTOR_GROUP";

export interface PollIntervalOptions {
  pollInterval: number;
  maxPollTimes: number;
}
