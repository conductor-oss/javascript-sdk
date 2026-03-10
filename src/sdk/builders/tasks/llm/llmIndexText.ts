import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";
import type { EmbeddingModel } from "./types";

export interface LlmIndexTextOptions {
  namespace?: string;
  metadata?: Record<string, unknown>;
  url?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  dimensions?: number;
}

export const llmIndexTextTask = (
  taskReferenceName: string,
  vectorDb: string,
  index: string,
  embeddingModel: EmbeddingModel,
  text: string,
  docId: string,
  options?: LlmIndexTextOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_INDEX_TEXT,
  inputParameters: {
    vectorDB: vectorDb,
    index,
    embeddingModelProvider: embeddingModel.provider,
    embeddingModel: embeddingModel.model,
    text,
    docId,
    ...options,
  },
});
