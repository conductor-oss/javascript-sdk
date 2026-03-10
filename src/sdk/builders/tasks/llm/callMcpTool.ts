import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";

export interface CallMcpToolOptions {
  inputParameters?: Record<string, unknown>;
}

export const callMcpToolTask = (
  taskReferenceName: string,
  mcpServer: string,
  method: string,
  options?: CallMcpToolOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.CALL_MCP_TOOL,
  inputParameters: {
    mcpServer,
    method,
    ...options?.inputParameters,
  },
});
