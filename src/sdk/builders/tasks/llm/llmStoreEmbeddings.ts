import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";

export interface LlmStoreEmbeddingsOptions {
  namespace?: string;
  docId?: string;
  metadata?: Record<string, unknown>;
}

export const llmStoreEmbeddingsTask = (
  taskReferenceName: string,
  vectorDb: string,
  index: string,
  embeddings: number[],
  options?: LlmStoreEmbeddingsOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_STORE_EMBEDDINGS,
  inputParameters: {
    vectorDB: vectorDb,
    index,
    embeddings,
    ...options,
  },
});
