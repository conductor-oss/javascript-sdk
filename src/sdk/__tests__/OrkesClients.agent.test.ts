import { describe, expect, it } from "@jest/globals";
import { OrkesClients } from "../OrkesClients";
import { AgentClient } from "../clients/agent/AgentClient";
import { WorkflowClient } from "../clients/agent/WorkflowClient";
import { SchedulerClient } from "../clients/scheduler/SchedulerClient";
import type { Client } from "../../open-api";

const fakeClient = { getConfig: () => ({}) } as unknown as Client;

describe("OrkesClients agent getters", () => {
  it("getAgentClient returns an AgentClient reusing the factory's client", async () => {
    const clients = new OrkesClients(fakeClient);
    const agentClient = clients.getAgentClient();

    expect(agentClient).toBeInstanceOf(AgentClient);
    // The injected client is pre-seeded — getClient() must resolve to the
    // exact instance, not build a fresh one via createConductorClient.
    await expect(agentClient.getClient()).resolves.toBe(fakeClient);
  });

  it("getAgentWorkflowClient matches getAgentClient().workflows behavior", () => {
    const clients = new OrkesClients(fakeClient);
    const viaFactory = clients.getAgentWorkflowClient();
    const viaAgentClient = clients.getAgentClient().workflows;

    expect(viaFactory).toBeInstanceOf(WorkflowClient);
    expect(viaAgentClient).toBeInstanceOf(WorkflowClient);
  });

  it("agent schedules ride the injected client too", () => {
    const clients = new OrkesClients(fakeClient);
    expect(clients.getAgentClient().schedules).toBeInstanceOf(SchedulerClient);
  });
});
