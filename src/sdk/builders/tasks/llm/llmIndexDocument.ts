import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";
import type { EmbeddingModel } from "./types";

export interface LlmIndexDocumentOptions {
  namespace?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  docId?: string;
  metadata?: Record<string, unknown>;
  dimensions?: number;
}

export const llmIndexDocumentTask = (
  taskReferenceName: string,
  vectorDb: string,
  index: string,
  embeddingModel: EmbeddingModel,
  url: string,
  mediaType: string,
  options?: LlmIndexDocumentOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_INDEX_TEXT,
  inputParameters: {
    vectorDB: vectorDb,
    index,
    embeddingModelProvider: embeddingModel.provider,
    embeddingModel: embeddingModel.model,
    url,
    mediaType,
    ...options,
  },
});
