import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";
import type { LlmCompletionParams } from "./types";

export interface LlmTextCompleteOptions extends LlmCompletionParams {
  promptVariables?: Record<string, unknown>;
  promptVersion?: number;
  jsonOutput?: boolean;
}

export const llmTextCompleteTask = (
  taskReferenceName: string,
  provider: string,
  model: string,
  promptName: string,
  options?: LlmTextCompleteOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_TEXT_COMPLETE,
  inputParameters: {
    llmProvider: provider,
    model,
    promptName,
    ...options,
  },
});
