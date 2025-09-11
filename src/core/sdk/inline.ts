import { TaskType, InlineTaskDef } from "../../common/types";

export const inlineTask = (
  taskReferenceName: string,
  script: string,
  evaluatorType: "javascript" | "graaljs" = "javascript",
  optional?: boolean
): InlineTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  inputParameters: {
    evaluatorType,
    expression: script,
  },
  type: TaskType.INLINE,
  optional,
});
