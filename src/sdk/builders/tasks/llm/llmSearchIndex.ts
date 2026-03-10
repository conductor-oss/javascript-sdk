import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";
import type { EmbeddingModel } from "./types";

export interface LlmSearchIndexOptions {
  namespace?: string;
  maxResults?: number;
  dimensions?: number;
}

export const llmSearchIndexTask = (
  taskReferenceName: string,
  vectorDb: string,
  index: string,
  embeddingModel: EmbeddingModel,
  query: string,
  options?: LlmSearchIndexOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_SEARCH_INDEX,
  inputParameters: {
    vectorDB: vectorDb,
    index,
    embeddingModelProvider: embeddingModel.provider,
    embeddingModel: embeddingModel.model,
    query,
    ...options,
  },
});
