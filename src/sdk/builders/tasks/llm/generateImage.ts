import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";

export interface GenerateImageOptions {
  imageCount?: number;
  width?: number;
  height?: number;
}

export const generateImageTask = (
  taskReferenceName: string,
  provider: string,
  model: string,
  prompt: string,
  options?: GenerateImageOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.GENERATE_IMAGE,
  inputParameters: {
    llmProvider: provider,
    model,
    prompt,
    ...options,
  },
});
