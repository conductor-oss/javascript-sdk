import { WorkflowDef } from "../../open-api";

export const workflowGenerator = (
  overrides: Partial<WorkflowDef>
): WorkflowDef => ({
  name: "NewWorkflow_3nxbi",
  description:
    "Edit or extend this sample workflow. Set the workflow name to get started",
  version: 1,
  tasks: [],
  inputParameters: [],
  outputParameters: {},
  schemaVersion: 2,
  restartable: true,
  workflowStatusListenerEnabled: false,
  ownerEmail: "james.stuart@orkes.io",
  timeoutPolicy: "ALERT_ONLY",
  timeoutSeconds: 0,
  ...overrides,
});
