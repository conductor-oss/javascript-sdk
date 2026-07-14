import { describe, expect, it } from "@jest/globals";
import { OrkesClients } from "../OrkesClients";
import { OrkesAgentClient } from "../clients/agent/OrkesAgentClient";
import { WorkflowClient } from "../clients/agent/WorkflowClient";
import { SchedulerClient } from "../clients/scheduler/SchedulerClient";
import type { Client } from "../../open-api";

// `request` is required — it's how OrkesAgentClient's isConductorClient()
// distinguishes an already-built client from a plain connection config.
const fakeClient = {
  getConfig: () => ({}),
  request: () => Promise.resolve({ data: {}, request: {}, response: {} }),
} as unknown as Client;

describe("OrkesClients agent getters", () => {
  it("getAgentClient returns an AgentClient reusing the factory's client", async () => {
    const clients = new OrkesClients(fakeClient);
    // getAgentClient() returns the narrow AgentClient interface; the
    // concrete-class-only members below (getClient/workflows/schedules)
    // are exercised via the known runtime type, matching ruling #4c.
    const agentClient = clients.getAgentClient() as OrkesAgentClient;

    expect(agentClient).toBeInstanceOf(OrkesAgentClient);
    // The injected client is pre-seeded — getClient() must resolve to the
    // exact instance, not build a fresh one via createConductorClient.
    await expect(agentClient.getClient()).resolves.toBe(fakeClient);
  });

  it("getAgentWorkflowClient matches getAgentClient().workflows behavior", () => {
    const clients = new OrkesClients(fakeClient);
    const viaFactory = clients.getAgentWorkflowClient();
    const viaAgentClient = (clients.getAgentClient() as OrkesAgentClient).workflows;

    expect(viaFactory).toBeInstanceOf(WorkflowClient);
    expect(viaAgentClient).toBeInstanceOf(WorkflowClient);
  });

  it("agent schedules ride the injected client too", () => {
    const clients = new OrkesClients(fakeClient);
    expect((clients.getAgentClient() as OrkesAgentClient).schedules).toBeInstanceOf(SchedulerClient);
  });
});
