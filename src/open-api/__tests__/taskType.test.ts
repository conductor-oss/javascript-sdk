import { describe, expect, test } from "@jest/globals";
import { TaskType } from "@open-api/index";

describe("TaskType", () => {
  test("includes the agent task types supported by the server", () => {
    expect(TaskType.AGENT).toBe("AGENT");
    expect(TaskType.GET_AGENT_CARD).toBe("GET_AGENT_CARD");
    expect(TaskType.CANCEL_AGENT).toBe("CANCEL_AGENT");
  });
});
