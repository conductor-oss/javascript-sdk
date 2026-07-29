import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { AgentConfig } from "../config.js";
import { readRenamedEnv, resetRenamedEnvWarnings } from "../legacy-env.js";
import { ConductorAgentError, AgentspanError, AgentAPIError } from "../errors.js";

/**
 * The AGENTSPAN_* -> CONDUCTOR_AGENT_* rename keeps the old spellings working
 * as deprecated fallbacks. These tests are the guarantee: the rest of the suite
 * was mechanically renamed to the new names, so without this file nothing would
 * catch the fallback being dropped.
 */
describe("deprecated AGENTSPAN_* environment variables", () => {
  const keys = [
    "CONDUCTOR_AGENT_WORKER_THREADS",
    "AGENTSPAN_WORKER_THREADS",
    "CONDUCTOR_AGENT_STREAMING_ENABLED",
    "AGENTSPAN_STREAMING_ENABLED",
  ];
  const saved: Record<string, string | undefined> = {};
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    resetRenamedEnvWarnings();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] !== undefined) process.env[key] = saved[key];
      else delete process.env[key];
    }
    warnSpy.mockRestore();
  });

  it("resolves a legacy AGENTSPAN_* value when the canonical name is unset", () => {
    process.env.AGENTSPAN_WORKER_THREADS = "7";

    expect(new AgentConfig().workerThreadCount).toBe(7);
  });

  it("prefers the canonical CONDUCTOR_AGENT_* name over the legacy one", () => {
    process.env.CONDUCTOR_AGENT_WORKER_THREADS = "3";
    process.env.AGENTSPAN_WORKER_THREADS = "9";

    expect(new AgentConfig().workerThreadCount).toBe(3);
  });

  it("treats an empty legacy value as unset and falls through to the default", () => {
    process.env.AGENTSPAN_WORKER_THREADS = "";

    expect(new AgentConfig().workerThreadCount).toBe(1);
  });

  it("warns once per legacy name, naming the replacement", () => {
    process.env.AGENTSPAN_WORKER_THREADS = "2";

    readRenamedEnv("CONDUCTOR_AGENT_WORKER_THREADS", "AGENTSPAN_WORKER_THREADS");
    readRenamedEnv("CONDUCTOR_AGENT_WORKER_THREADS", "AGENTSPAN_WORKER_THREADS");
    readRenamedEnv("CONDUCTOR_AGENT_WORKER_THREADS", "AGENTSPAN_WORKER_THREADS");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("AGENTSPAN_WORKER_THREADS is deprecated");
    expect(String(warnSpy.mock.calls[0][0])).toContain("CONDUCTOR_AGENT_WORKER_THREADS");
  });

  it("does not warn when only the canonical name is set", () => {
    process.env.CONDUCTOR_AGENT_STREAMING_ENABLED = "false";

    expect(new AgentConfig().streamingEnabled).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("deprecated AgentspanError alias", () => {
  it("is the same class object as ConductorAgentError, not a subclass", () => {
    expect(AgentspanError).toBe(ConductorAgentError);
  });

  it("matches instanceof in both directions", () => {
    const viaNew = new ConductorAgentError("boom");
    const viaAlias = new AgentspanError("boom");

    expect(viaNew).toBeInstanceOf(AgentspanError);
    expect(viaAlias).toBeInstanceOf(ConductorAgentError);
  });

  it("still catches subclassed errors raised by the SDK", () => {
    const err = new AgentAPIError("failed", 500, "{}");

    expect(err).toBeInstanceOf(AgentspanError);
  });

  it("reports the canonical name on the instance", () => {
    expect(new AgentspanError("boom").name).toBe("ConductorAgentError");
  });
});
