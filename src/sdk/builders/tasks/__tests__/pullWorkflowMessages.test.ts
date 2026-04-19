import { pullWorkflowMessages } from "@/sdk/builders/tasks/pullWorkflowMessages";
import { TaskType } from "@open-api/index";
import { describe, expect, test } from "@jest/globals";

describe("pullWorkflowMessages", () => {
  test("returns correct task type", () => {
    const task = pullWorkflowMessages("pull_ref");
    expect(task.type).toBe(TaskType.PULL_WORKFLOW_MESSAGES);
  });

  test("sets taskReferenceName and name from first argument", () => {
    const task = pullWorkflowMessages("pull_ref");
    expect(task.taskReferenceName).toBe("pull_ref");
    expect(task.name).toBe("pull_ref");
  });

  test("defaults batchSize to 1", () => {
    const task = pullWorkflowMessages("pull_ref");
    expect(task.inputParameters.batchSize).toBe(1);
  });

  test("accepts custom batchSize", () => {
    const task = pullWorkflowMessages("pull_ref", 10);
    expect(task.inputParameters.batchSize).toBe(10);
  });

  test("accepts optional flag", () => {
    const task = pullWorkflowMessages("pull_ref", 1, true);
    expect(task.optional).toBe(true);
  });

  test("optional is undefined when not specified", () => {
    const task = pullWorkflowMessages("pull_ref");
    expect(task.optional).toBeUndefined();
  });
});
