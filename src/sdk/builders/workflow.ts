import type { TaskDefTypes, WorkflowDef } from "../../open-api";

export const workflow = (name: string, tasks: TaskDefTypes[]): WorkflowDef => ({
  name,
  version: 1,
  tasks,
  inputParameters: [],
  timeoutSeconds: 0,
});
