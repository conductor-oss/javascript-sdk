import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";

export interface LlmGenerateEmbeddingsOptions {
  instructions?: string;
  dimensions?: number;
}

export const llmGenerateEmbeddingsTask = (
  taskReferenceName: string,
  provider: string,
  model: string,
  text: string,
  options?: LlmGenerateEmbeddingsOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_GENERATE_EMBEDDINGS,
  inputParameters: {
    llmProvider: provider,
    model,
    text,
    ...options,
  },
});
