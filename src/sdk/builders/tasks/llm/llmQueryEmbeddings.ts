import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";

export interface LlmQueryEmbeddingsOptions {
  namespace?: string;
}

export const llmQueryEmbeddingsTask = (
  taskReferenceName: string,
  vectorDb: string,
  index: string,
  embeddings: number[],
  options?: LlmQueryEmbeddingsOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_GET_EMBEDDINGS,
  inputParameters: {
    vectorDB: vectorDb,
    index,
    embeddings,
    ...options,
  },
});
