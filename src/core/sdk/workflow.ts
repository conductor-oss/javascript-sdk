import { TaskDefTypes } from "../../common/types";
import { WorkflowDef } from "../../common";

export const workflow = (name: string, tasks: TaskDefTypes[]): WorkflowDef => ({
  name,
  version: 1,
  tasks,
  inputParameters: [],
  timeoutSeconds: 0,
});
