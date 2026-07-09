/**
 * The agent-layer `ScheduleClient` (raw-fetch transport) and its
 * `SchedulerFetcher` interface were deleted in favor of the SDK's
 * `SchedulerClient` (no backward compatibility). This pins the absence so
 * they don't silently reappear — the Python SDK enforces the same deletion
 * (`test_agent_schedule_client_is_gone`).
 */
import { describe, expect, it } from "@jest/globals";
import * as agents from "../index.js";
import { OrkesClients } from "../../sdk/OrkesClients";

describe("ScheduleClient deletion (no backward compatibility)", () => {
  it("the agents barrel no longer exports ScheduleClient", () => {
    expect((agents as Record<string, unknown>).ScheduleClient).toBeUndefined();
  });

  it("the agents barrel re-exports SchedulerClient in its place", () => {
    expect(agents.SchedulerClient).toBeDefined();
  });

  it("OrkesClients grew no getAgentScheduleClient getter", () => {
    expect(
      (OrkesClients.prototype as unknown as Record<string, unknown>)
        .getAgentScheduleClient,
    ).toBeUndefined();
  });
});
