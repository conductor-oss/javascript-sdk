import { jest, test, expect, describe, beforeEach, afterEach } from "@jest/globals";
import {
  resolveWorkerConfig,
  getWorkerConfigSummary,
  getWorkerConfigOneline,
  type WorkerConfig,
} from "../WorkerConfig";

describe("WorkerConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear environment variables before each test
    process.env = { ...originalEnv };
    // Remove all CONDUCTOR_WORKER_* variables
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith("CONDUCTOR_WORKER") || key.startsWith("conductor.worker")) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("resolveWorkerConfig", () => {
    test("should use code defaults when no env vars set", () => {
      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
        domain: "dev",
        concurrency: 5,
      });

      expect(config.pollInterval).toBe(1000);
      expect(config.domain).toBe("dev");
      expect(config.concurrency).toBe(5);
    });

    test("should use system defaults when no code defaults or env vars", () => {
      const config = resolveWorkerConfig("test_worker", {});

      expect(config.pollInterval).toBe(100); // System default
      expect(config.concurrency).toBe(1); // System default
      expect(config.registerTaskDef).toBe(false); // System default
      expect(config.overwriteTaskDef).toBe(true); // System default
      expect(config.strictSchema).toBe(false); // System default
    });

    test("should override with worker-specific env var (uppercase)", () => {
      process.env.CONDUCTOR_WORKER_TEST_WORKER_POLL_INTERVAL = "2000";
      process.env.CONDUCTOR_WORKER_TEST_WORKER_DOMAIN = "production";

      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
        domain: "dev",
      });

      expect(config.pollInterval).toBe(2000);
      expect(config.domain).toBe("production");
    });

    test("should override with worker-specific env var (dotted)", () => {
      process.env["conductor.worker.test_worker.poll_interval"] = "3000";
      process.env["conductor.worker.test_worker.domain"] = "staging";

      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
        domain: "dev",
      });

      expect(config.pollInterval).toBe(3000);
      expect(config.domain).toBe("staging");
    });

    test("should override with global env var (uppercase)", () => {
      process.env.CONDUCTOR_WORKER_ALL_POLL_INTERVAL = "500";
      process.env.CONDUCTOR_WORKER_ALL_CONCURRENCY = "10";

      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
        concurrency: 5,
      });

      expect(config.pollInterval).toBe(500);
      expect(config.concurrency).toBe(10);
    });

    test("should override with global env var (dotted)", () => {
      process.env["conductor.worker.all.poll_interval"] = "600";
      process.env["conductor.worker.all.concurrency"] = "15";

      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
        concurrency: 5,
      });

      expect(config.pollInterval).toBe(600);
      expect(config.concurrency).toBe(15);
    });

    test("should prioritize worker-specific over global", () => {
      process.env.CONDUCTOR_WORKER_ALL_POLL_INTERVAL = "500";
      process.env.CONDUCTOR_WORKER_TEST_WORKER_POLL_INTERVAL = "2000";

      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
      });

      expect(config.pollInterval).toBe(2000); // Worker-specific wins
    });

    test("should prioritize uppercase over dotted for same level", () => {
      process.env.CONDUCTOR_WORKER_TEST_WORKER_POLL_INTERVAL = "2000";
      process.env["conductor.worker.test_worker.poll_interval"] = "3000";

      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
      });

      expect(config.pollInterval).toBe(2000); // Uppercase checked first
    });

    test("should handle boolean values", () => {
      process.env.CONDUCTOR_WORKER_TEST_WORKER_REGISTER_TASK_DEF = "true";
      process.env.CONDUCTOR_WORKER_TEST_WORKER_PAUSED = "false";
      process.env.CONDUCTOR_WORKER_ALL_OVERWRITE_TASK_DEF = "false";
      process.env.CONDUCTOR_WORKER_ALL_STRICT_SCHEMA = "true";

      const config = resolveWorkerConfig("test_worker", {});

      expect(config.registerTaskDef).toBe(true);
      expect(config.paused).toBe(false);
      expect(config.overwriteTaskDef).toBe(false);
      expect(config.strictSchema).toBe(true);
    });

    test("should handle boolean values with various formats", () => {
      process.env.CONDUCTOR_WORKER_W1_REGISTER_TASK_DEF = "1";
      process.env.CONDUCTOR_WORKER_W2_REGISTER_TASK_DEF = "yes";
      process.env.CONDUCTOR_WORKER_W3_REGISTER_TASK_DEF = "on";
      process.env.CONDUCTOR_WORKER_W4_REGISTER_TASK_DEF = "TRUE";

      expect(resolveWorkerConfig("w1", {}).registerTaskDef).toBe(true);
      expect(resolveWorkerConfig("w2", {}).registerTaskDef).toBe(true);
      expect(resolveWorkerConfig("w3", {}).registerTaskDef).toBe(true);
      expect(resolveWorkerConfig("w4", {}).registerTaskDef).toBe(true);
    });

    test("should handle number values", () => {
      process.env.CONDUCTOR_WORKER_TEST_WORKER_POLL_INTERVAL = "2500";
      process.env.CONDUCTOR_WORKER_TEST_WORKER_CONCURRENCY = "20";
      process.env.CONDUCTOR_WORKER_TEST_WORKER_POLL_TIMEOUT = "300";

      const config = resolveWorkerConfig("test_worker", {});

      expect(config.pollInterval).toBe(2500);
      expect(config.concurrency).toBe(20);
      expect(config.pollTimeout).toBe(300);
    });

    test("should handle invalid number values gracefully", () => {
      process.env.CONDUCTOR_WORKER_TEST_WORKER_POLL_INTERVAL = "invalid";

      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
      });

      // Should fall back to code default
      expect(config.pollInterval).toBe(1000);
    });

    test("should handle string values", () => {
      process.env.CONDUCTOR_WORKER_TEST_WORKER_DOMAIN = "production";
      process.env.CONDUCTOR_WORKER_TEST_WORKER_WORKER_ID = "worker-123";

      const config = resolveWorkerConfig("test_worker", {});

      expect(config.domain).toBe("production");
      expect(config.workerId).toBe("worker-123");
    });

    test("should handle all properties", () => {
      process.env.CONDUCTOR_WORKER_ALL_POLL_INTERVAL = "500";
      process.env.CONDUCTOR_WORKER_ALL_DOMAIN = "global-domain";
      process.env.CONDUCTOR_WORKER_ALL_WORKER_ID = "global-worker";
      process.env.CONDUCTOR_WORKER_ALL_CONCURRENCY = "10";
      process.env.CONDUCTOR_WORKER_ALL_REGISTER_TASK_DEF = "true";
      process.env.CONDUCTOR_WORKER_ALL_POLL_TIMEOUT = "200";
      process.env.CONDUCTOR_WORKER_ALL_PAUSED = "false";
      process.env.CONDUCTOR_WORKER_ALL_OVERWRITE_TASK_DEF = "false";
      process.env.CONDUCTOR_WORKER_ALL_STRICT_SCHEMA = "true";

      const config = resolveWorkerConfig("test_worker", {});

      expect(config.pollInterval).toBe(500);
      expect(config.domain).toBe("global-domain");
      expect(config.workerId).toBe("global-worker");
      expect(config.concurrency).toBe(10);
      expect(config.registerTaskDef).toBe(true);
      expect(config.pollTimeout).toBe(200);
      expect(config.paused).toBe(false);
      expect(config.overwriteTaskDef).toBe(false);
      expect(config.strictSchema).toBe(true);
    });

    test("should handle mixed sources", () => {
      // Global env var
      process.env.CONDUCTOR_WORKER_ALL_POLL_INTERVAL = "500";
      
      // Worker-specific env var
      process.env.CONDUCTOR_WORKER_TEST_WORKER_CONCURRENCY = "20";

      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000, // Overridden by global
        concurrency: 5,     // Overridden by worker-specific
        domain: "dev",      // From code
      });

      expect(config.pollInterval).toBe(500);
      expect(config.concurrency).toBe(20);
      expect(config.domain).toBe("dev");
    });
  });

  describe("getWorkerConfigSummary", () => {
    test("should generate summary with code defaults", () => {
      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
        domain: "dev",
      });

      const summary = getWorkerConfigSummary("test_worker", config);

      expect(summary).toContain("Worker 'test_worker' configuration:");
      expect(summary).toContain("pollInterval: 1000 (from code)");
      expect(summary).toContain("domain: dev (from code)");
    });

    test("should generate summary with env var sources", () => {
      process.env.CONDUCTOR_WORKER_ALL_POLL_INTERVAL = "500";
      process.env.CONDUCTOR_WORKER_TEST_WORKER_DOMAIN = "production";

      const config = resolveWorkerConfig("test_worker", {});
      const summary = getWorkerConfigSummary("test_worker", config);

      expect(summary).toContain("pollInterval: 500 (from CONDUCTOR_WORKER_ALL_POLL_INTERVAL)");
      expect(summary).toContain("domain: production (from CONDUCTOR_WORKER_TEST_WORKER_DOMAIN)");
    });

    test("should skip undefined values", () => {
      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
        // domain is undefined
      });

      const summary = getWorkerConfigSummary("test_worker", config);

      expect(summary).toContain("pollInterval");
      expect(summary).not.toContain("domain: undefined");
    });
  });

  describe("getWorkerConfigOneline", () => {
    test("should generate compact one-line summary", () => {
      const config = resolveWorkerConfig("test_worker", {
        pollInterval: 1000,
        domain: "production",
        concurrency: 5,
      });

      const oneline = getWorkerConfigOneline("test_worker", config);

      expect(oneline).toContain("Conductor Worker[");
      expect(oneline).toContain("name=test_worker");
      expect(oneline).toContain(`pid=${process.pid}`);
      expect(oneline).toContain("status=active");
      expect(oneline).toContain("poll_interval=1000ms");
      expect(oneline).toContain("domain=production");
      expect(oneline).toContain("concurrency=5");
    });

    test("should show paused status", () => {
      const config = resolveWorkerConfig("test_worker", {
        paused: true,
      });

      const oneline = getWorkerConfigOneline("test_worker", config);

      expect(oneline).toContain("status=paused");
    });

    test("should handle minimal config", () => {
      const config = resolveWorkerConfig("test_worker", {});
      const oneline = getWorkerConfigOneline("test_worker", config);

      expect(oneline).toContain("Conductor Worker[");
      expect(oneline).toContain("name=test_worker");
      expect(oneline).toContain("status=active");
    });
  });

  describe("camelCase to snake_case conversion", () => {
    test("should handle various property names", () => {
      process.env.CONDUCTOR_WORKER_TEST_POLL_INTERVAL = "1000";
      process.env.CONDUCTOR_WORKER_TEST_WORKER_ID = "w1";
      process.env.CONDUCTOR_WORKER_TEST_REGISTER_TASK_DEF = "true";
      process.env.CONDUCTOR_WORKER_TEST_OVERWRITE_TASK_DEF = "false";

      const config = resolveWorkerConfig("test", {});

      expect(config.pollInterval).toBe(1000);
      expect(config.workerId).toBe("w1");
      expect(config.registerTaskDef).toBe(true);
      expect(config.overwriteTaskDef).toBe(false);
    });
  });
});
