import { expect, describe, it, beforeEach, afterEach } from "@jest/globals";
import { resolveOrkesConfig } from "../resolveOrkesConfig";
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  REFRESH_TOKEN_IN_MILLISECONDS,
} from "../../constants";

describe("resolveOrkesConfig", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "CONDUCTOR_SERVER_URL",
    "CONDUCTOR_AUTH_KEY",
    "CONDUCTOR_AUTH_SECRET",
    "CONDUCTOR_MAX_HTTP2_CONNECTIONS",
    "CONDUCTOR_REFRESH_TOKEN_INTERVAL",
    "CONDUCTOR_REQUEST_TIMEOUT_MS",
    "CONDUCTOR_CONNECT_TIMEOUT_MS",
    "CONDUCTOR_TLS_CERT_PATH",
    "CONDUCTOR_TLS_KEY_PATH",
    "CONDUCTOR_TLS_CA_PATH",
    "CONDUCTOR_PROXY_URL",
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

  // ─── Server URL normalization ──────────────────────────────────────

  describe("serverUrl", () => {
    it("should use config serverUrl", () => {
      const result = resolveOrkesConfig({ serverUrl: "http://localhost:8080" });
      expect(result.serverUrl).toBe("http://localhost:8080");
    });

    it("should prefer env var over config", () => {
      process.env.CONDUCTOR_SERVER_URL = "http://env-server:8080";
      const result = resolveOrkesConfig({ serverUrl: "http://config-server:8080" });
      expect(result.serverUrl).toBe("http://env-server:8080");
    });

    it("should strip trailing slash", () => {
      const result = resolveOrkesConfig({ serverUrl: "http://localhost:8080/" });
      expect(result.serverUrl).toBe("http://localhost:8080");
    });

    it("should strip trailing /api", () => {
      const result = resolveOrkesConfig({ serverUrl: "http://localhost:8080/api" });
      expect(result.serverUrl).toBe("http://localhost:8080");
    });

    it("should strip trailing /api/ (slash then api)", () => {
      const result = resolveOrkesConfig({ serverUrl: "http://localhost:8080/api/" });
      // First strips trailing slash -> "http://localhost:8080/api"
      // Then strips /api -> "http://localhost:8080"
      expect(result.serverUrl).toBe("http://localhost:8080");
    });
  });

  // ─── Numeric env vars: Number("0") edge case ──────────────────────

  describe("numeric env var parsing", () => {
    it("should accept 0 as a valid number from env var (requestTimeoutMs)", () => {
      process.env.CONDUCTOR_REQUEST_TIMEOUT_MS = "0";
      const result = resolveOrkesConfig({});
      expect(result.requestTimeoutMs).toBe(0);
    });

    it("should accept 0 as a valid number from env var (refreshTokenInterval)", () => {
      process.env.CONDUCTOR_REFRESH_TOKEN_INTERVAL = "0";
      const result = resolveOrkesConfig({});
      expect(result.refreshTokenInterval).toBe(0);
    });

    it("should accept 0 as a valid number from env var (maxHttp2Connections)", () => {
      process.env.CONDUCTOR_MAX_HTTP2_CONNECTIONS = "0";
      const result = resolveOrkesConfig({});
      expect(result.maxHttp2Connections).toBe(0);
    });

    it("should ignore invalid (NaN) env var and fall back to config", () => {
      process.env.CONDUCTOR_REQUEST_TIMEOUT_MS = "not-a-number";
      const result = resolveOrkesConfig({ requestTimeoutMs: 5000 });
      expect(result.requestTimeoutMs).toBe(5000);
    });

    it("should ignore empty string env var and fall back to config", () => {
      process.env.CONDUCTOR_REQUEST_TIMEOUT_MS = "";
      const result = resolveOrkesConfig({ requestTimeoutMs: 5000 });
      expect(result.requestTimeoutMs).toBe(5000);
    });

    it("should use positive env var values normally", () => {
      process.env.CONDUCTOR_REQUEST_TIMEOUT_MS = "30000";
      const result = resolveOrkesConfig({});
      expect(result.requestTimeoutMs).toBe(30000);
    });
  });

  // ─── Defaults ──────────────────────────────────────────────────────

  describe("defaults", () => {
    it("should use default refreshTokenInterval when nothing provided", () => {
      const result = resolveOrkesConfig({});
      expect(result.refreshTokenInterval).toBe(REFRESH_TOKEN_IN_MILLISECONDS);
    });

    it("should use default requestTimeoutMs when nothing provided", () => {
      const result = resolveOrkesConfig({});
      expect(result.requestTimeoutMs).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    });

    it("should use default connectTimeoutMs when nothing provided", () => {
      const result = resolveOrkesConfig({});
      expect(result.connectTimeoutMs).toBe(DEFAULT_CONNECT_TIMEOUT_MS);
    });

    it("should return undefined for optional fields when nothing provided", () => {
      const result = resolveOrkesConfig({});
      expect(result.serverUrl).toBeUndefined();
      expect(result.keyId).toBeUndefined();
      expect(result.keySecret).toBeUndefined();
      expect(result.maxHttp2Connections).toBeUndefined();
      expect(result.logger).toBeUndefined();
      expect(result.tlsCertPath).toBeUndefined();
      expect(result.tlsKeyPath).toBeUndefined();
      expect(result.tlsCaPath).toBeUndefined();
      expect(result.proxyUrl).toBeUndefined();
    });
  });

  // ─── Config value passthrough ──────────────────────────────────────

  describe("config passthrough", () => {
    it("should pass through logger from config", () => {
      const logger = { info: () => {}, error: () => {}, debug: () => {} };
      const result = resolveOrkesConfig({ logger });
      expect(result.logger).toBe(logger);
    });

    it("should prefer env var over config for numeric fields", () => {
      process.env.CONDUCTOR_REQUEST_TIMEOUT_MS = "10000";
      const result = resolveOrkesConfig({ requestTimeoutMs: 5000 });
      expect(result.requestTimeoutMs).toBe(10000);
    });
  });

  // ─── Connect timeout ───────────────────────────────────────────────

  describe("connectTimeoutMs", () => {
    it("should resolve from env var", () => {
      process.env.CONDUCTOR_CONNECT_TIMEOUT_MS = "5000";
      expect(resolveOrkesConfig({}).connectTimeoutMs).toBe(5000);
    });

    it("should resolve from config", () => {
      expect(resolveOrkesConfig({ connectTimeoutMs: 3000 }).connectTimeoutMs).toBe(3000);
    });

    it("should accept 0 from env var", () => {
      process.env.CONDUCTOR_CONNECT_TIMEOUT_MS = "0";
      expect(resolveOrkesConfig({}).connectTimeoutMs).toBe(0);
    });
  });

  // ─── TLS config ────────────────────────────────────────────────────

  describe("TLS config", () => {
    it("should resolve TLS paths from env vars", () => {
      process.env.CONDUCTOR_TLS_CERT_PATH = "/path/to/cert.pem";
      process.env.CONDUCTOR_TLS_KEY_PATH = "/path/to/key.pem";
      process.env.CONDUCTOR_TLS_CA_PATH = "/path/to/ca.pem";

      const result = resolveOrkesConfig({});
      expect(result.tlsCertPath).toBe("/path/to/cert.pem");
      expect(result.tlsKeyPath).toBe("/path/to/key.pem");
      expect(result.tlsCaPath).toBe("/path/to/ca.pem");
    });

    it("should resolve TLS paths from config", () => {
      const result = resolveOrkesConfig({
        tlsCertPath: "/config/cert.pem",
        tlsKeyPath: "/config/key.pem",
        tlsCaPath: "/config/ca.pem",
      });
      expect(result.tlsCertPath).toBe("/config/cert.pem");
      expect(result.tlsKeyPath).toBe("/config/key.pem");
      expect(result.tlsCaPath).toBe("/config/ca.pem");
    });

    it("should prefer env var over config for TLS paths", () => {
      process.env.CONDUCTOR_TLS_CERT_PATH = "/env/cert.pem";
      const result = resolveOrkesConfig({ tlsCertPath: "/config/cert.pem" });
      expect(result.tlsCertPath).toBe("/env/cert.pem");
    });
  });

  // ─── Proxy config ──────────────────────────────────────────────────

  describe("proxy config", () => {
    it("should resolve proxyUrl from env var", () => {
      process.env.CONDUCTOR_PROXY_URL = "http://proxy:8080";
      expect(resolveOrkesConfig({}).proxyUrl).toBe("http://proxy:8080");
    });

    it("should resolve proxyUrl from config", () => {
      expect(resolveOrkesConfig({ proxyUrl: "http://proxy:3128" }).proxyUrl).toBe("http://proxy:3128");
    });

    it("should prefer env var over config for proxyUrl", () => {
      process.env.CONDUCTOR_PROXY_URL = "http://env-proxy:8080";
      const result = resolveOrkesConfig({ proxyUrl: "http://config-proxy:8080" });
      expect(result.proxyUrl).toBe("http://env-proxy:8080");
    });
  });
});

