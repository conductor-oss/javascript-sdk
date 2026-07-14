import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { AgentConfig } from "../config.js";
import type { AgentConfigOptions } from "../config.js";

describe("AgentConfig", () => {
  // Save and restore env vars to avoid test pollution
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "AGENTSPAN_WORKER_POLL_INTERVAL",
    "AGENTSPAN_WORKER_THREADS",
    "AGENTSPAN_AUTO_START_WORKERS",
    "AGENTSPAN_STREAMING_ENABLED",
    "AGENTSPAN_LIVENESS_ENABLED",
    "AGENTSPAN_LIVENESS_STALL_SECONDS",
    "AGENTSPAN_LIVENESS_CHECK_INTERVAL_SECONDS",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  describe("defaults", () => {
    it("uses default values when no options or env vars", () => {
      const config = new AgentConfig();

      expect(config.workerPollIntervalMs).toBe(100);
      expect(config.workerThreadCount).toBe(1);
      expect(config.autoStartWorkers).toBe(true);
      expect(config.streamingEnabled).toBe(true);
      expect(config.livenessEnabled).toBe(true);
      expect(config.livenessStallSeconds).toBe(30.0);
      expect(config.livenessCheckIntervalSeconds).toBe(10.0);
    });
  });

  describe("constructor overrides", () => {
    it("accepts all 7 knobs", () => {
      const config = new AgentConfig({
        workerPollIntervalMs: 500,
        workerThreadCount: 4,
        autoStartWorkers: false,
        streamingEnabled: false,
        livenessEnabled: false,
        livenessStallSeconds: 45.5,
        livenessCheckIntervalSeconds: 5.5,
      });

      expect(config.workerPollIntervalMs).toBe(500);
      expect(config.workerThreadCount).toBe(4);
      expect(config.autoStartWorkers).toBe(false);
      expect(config.streamingEnabled).toBe(false);
      expect(config.livenessEnabled).toBe(false);
      expect(config.livenessStallSeconds).toBe(45.5);
      expect(config.livenessCheckIntervalSeconds).toBe(5.5);
    });
  });

  describe("env var loading", () => {
    it("reads all AGENTSPAN_ env vars", () => {
      process.env.AGENTSPAN_WORKER_POLL_INTERVAL = "200";
      process.env.AGENTSPAN_WORKER_THREADS = "2";
      process.env.AGENTSPAN_AUTO_START_WORKERS = "false";
      process.env.AGENTSPAN_STREAMING_ENABLED = "false";
      process.env.AGENTSPAN_LIVENESS_ENABLED = "false";
      process.env.AGENTSPAN_LIVENESS_STALL_SECONDS = "60.5";
      process.env.AGENTSPAN_LIVENESS_CHECK_INTERVAL_SECONDS = "20.5";

      const config = new AgentConfig();

      expect(config.workerPollIntervalMs).toBe(200);
      expect(config.workerThreadCount).toBe(2);
      expect(config.autoStartWorkers).toBe(false);
      expect(config.streamingEnabled).toBe(false);
      expect(config.livenessEnabled).toBe(false);
      expect(config.livenessStallSeconds).toBe(60.5);
      expect(config.livenessCheckIntervalSeconds).toBe(20.5);
    });

    it("options override env vars", () => {
      process.env.AGENTSPAN_WORKER_THREADS = "9";
      const config = new AgentConfig({ workerThreadCount: 3 });
      expect(config.workerThreadCount).toBe(3);
    });

    it("handles boolean env var variations", () => {
      process.env.AGENTSPAN_AUTO_START_WORKERS = "1";
      process.env.AGENTSPAN_STREAMING_ENABLED = "no";

      const config = new AgentConfig();

      expect(config.autoStartWorkers).toBe(true);
      expect(config.streamingEnabled).toBe(false);
    });

    it("handles invalid numeric env vars gracefully", () => {
      process.env.AGENTSPAN_WORKER_POLL_INTERVAL = "not-a-number";
      process.env.AGENTSPAN_WORKER_THREADS = "";

      const config = new AgentConfig();

      expect(config.workerPollIntervalMs).toBe(100);
      expect(config.workerThreadCount).toBe(1);
    });

    it("falls back to default when a liveness float env var is empty or invalid", () => {
      process.env.AGENTSPAN_LIVENESS_STALL_SECONDS = "";
      process.env.AGENTSPAN_LIVENESS_CHECK_INTERVAL_SECONDS = "not-a-float";

      const config = new AgentConfig();

      expect(config.livenessStallSeconds).toBe(30.0);
      expect(config.livenessCheckIntervalSeconds).toBe(10.0);
    });
  });

  describe("fromEnv", () => {
    it("creates config from env vars only", () => {
      process.env.AGENTSPAN_WORKER_THREADS = "6";
      const config = AgentConfig.fromEnv();
      expect(config.workerThreadCount).toBe(6);
    });

    it("uses defaults when no env vars set", () => {
      const config = AgentConfig.fromEnv();
      expect(config.workerThreadCount).toBe(1);
      expect(config.autoStartWorkers).toBe(true);
    });
  });

  describe("type-level guard (spec R4/T7)", () => {
    it("AgentConfigOptions has no connection/auth/log keys", () => {
      // Compile-time guard: constructing with a connection/auth/log field is
      // a type error. The @ts-expect-error below documents exactly that —
      // if any of these fields were ever re-added, this test would fail to
      // compile (the directive would become "unused").
      // @ts-expect-error -- serverUrl is not part of the behavior-only AgentConfigOptions
      const bad1: AgentConfigOptions = { serverUrl: "http://localhost:8080" };
      // @ts-expect-error -- apiKey is not part of the behavior-only AgentConfigOptions
      const bad2: AgentConfigOptions = { apiKey: "x" };
      // @ts-expect-error -- authKey is not part of the behavior-only AgentConfigOptions
      const bad3: AgentConfigOptions = { authKey: "x" };
      // @ts-expect-error -- logLevel is not part of the behavior-only AgentConfigOptions
      const bad4: AgentConfigOptions = { logLevel: "DEBUG" };
      expect([bad1, bad2, bad3, bad4]).toHaveLength(4);
    });
  });
});
