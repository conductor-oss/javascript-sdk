import type { WorkflowTask } from "../../../../open-api";
import { TaskType } from "../../../../open-api";

export interface ListMcpToolsOptions {
  filter?: string;
}

export const listMcpToolsTask = (
  taskReferenceName: string,
  mcpServer: string,
  options?: ListMcpToolsOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.LIST_MCP_TOOLS,
  inputParameters: {
    mcpServer,
    ...options,
  },
});
