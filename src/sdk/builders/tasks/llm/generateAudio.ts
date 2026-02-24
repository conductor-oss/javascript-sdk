import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";

export interface GenerateAudioOptions {
  text?: string;
  voice?: string;
  speed?: number;
}

export const generateAudioTask = (
  taskReferenceName: string,
  provider: string,
  model: string,
  options?: GenerateAudioOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.GENERATE_AUDIO,
  inputParameters: {
    llmProvider: provider,
    model,
    ...options,
  },
});
