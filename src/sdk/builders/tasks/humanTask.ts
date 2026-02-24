import type { WorkflowTask } from "../../../open-api";
import { TaskType } from "../../../open-api";

export type AssignmentCompletionStrategy = "LEAVE_OPEN" | "TERMINATE";

export interface HumanTaskOptions {
  displayName?: string;
  formTemplate?: string;
  formVersion?: number;
  assignmentCompletionStrategy?: AssignmentCompletionStrategy;
  assignee?: { userType: "EXTERNAL_USER" | "EXTERNAL_GROUP"; user: string };
  optional?: boolean;
}

export const humanTask = (
  taskReferenceName: string,
  options?: HumanTaskOptions
): WorkflowTask => {
  const humanTaskDef: Record<string, unknown> = {};

  if (options?.assignmentCompletionStrategy !== undefined) {
    humanTaskDef.assignmentCompletionStrategy =
      options.assignmentCompletionStrategy;
  }
  if (options?.displayName !== undefined) {
    humanTaskDef.displayName = options.displayName;
  }
  if (options?.formTemplate !== undefined) {
    humanTaskDef.userFormTemplate = {
      name: options.formTemplate,
      version: options.formVersion ?? 0,
    };
  }
  if (options?.assignee !== undefined) {
    humanTaskDef.assignee = {
      userType: options.assignee.userType,
      user: options.assignee.user,
    };
  }

  return {
    name: taskReferenceName,
    taskReferenceName,
    type: TaskType.HUMAN,
    inputParameters: {
      __humanTaskDefinition: humanTaskDef,
    },
    optional: options?.optional,
  };
};
