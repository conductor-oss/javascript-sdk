import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";

export interface LlmSearchEmbeddingsOptions {
  namespace?: string;
  maxResults?: number;
}

export const llmSearchEmbeddingsTask = (
  taskReferenceName: string,
  vectorDb: string,
  index: string,
  embeddings: number[],
  options?: LlmSearchEmbeddingsOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_SEARCH_EMBEDDINGS,
  inputParameters: {
    vectorDB: vectorDb,
    index,
    embeddings,
    ...options,
  },
});
