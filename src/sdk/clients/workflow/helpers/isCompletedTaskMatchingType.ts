import { Task } from "../../../../open-api";
import { TaskFinderPredicate } from "../types";

export const isCompletedTaskMatchingType =
  (taskType: string): TaskFinderPredicate =>
  (task: Task) =>
    task.status === "COMPLETED" && task.taskType === taskType;
