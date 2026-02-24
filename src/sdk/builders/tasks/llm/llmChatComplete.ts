import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";
import type { ChatMessage, LlmCompletionParams, ToolSpec } from "./types";

export interface LlmChatCompleteOptions extends LlmCompletionParams {
  messages?: ChatMessage[];
  instructionsTemplate?: string;
  promptVariables?: Record<string, unknown>;
  promptVersion?: number;
  userInput?: string;
  tools?: ToolSpec[];
  jsonOutput?: boolean;
  outputSchema?: Record<string, unknown>;
  outputMimeType?: string;
  outputLocation?: string;
  googleSearchRetrieval?: boolean;
  inputSchema?: Record<string, unknown>;
  thinkingTokenLimit?: number;
  reasoningEffort?: string;
  voice?: string;
  participants?: string[];
}

export const llmChatCompleteTask = (
  taskReferenceName: string,
  provider: string,
  model: string,
  options?: LlmChatCompleteOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LLM_CHAT_COMPLETE,
  inputParameters: {
    llmProvider: provider,
    model,
    ...options,
  },
});
