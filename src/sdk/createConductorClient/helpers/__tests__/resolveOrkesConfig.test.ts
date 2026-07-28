import { expect, describe, it, beforeEach, afterEach, jest } from "@jest/globals";
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
    "CONDUCTOR_TLS_INSECURE",
    "CONDUCTOR_DISABLE_HTTP2",
    "AGENTSPAN_SERVER_URL",
    "AGENTSPAN_AUTH_KEY",
    "AGENTSPAN_AUTH_SECRET",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
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

    // ─── CONDUCTOR_* -> explicit -> localhost:8080 (no legacy fallback) ──

    it("defaults to http://localhost:8080 when nothing is set", () => {
      expect(resolveOrkesConfig({}).serverUrl).toBe("http://localhost:8080");
    });

    it("CONDUCTOR_SERVER_URL wins over explicit config", () => {
      process.env.CONDUCTOR_SERVER_URL = "http://conductor-env:8080";
      expect(resolveOrkesConfig({ serverUrl: "http://explicit:1234" }).serverUrl).toBe(
        "http://conductor-env:8080"
      );
    });

    it("ignores a legacy AGENTSPAN_SERVER_URL env var entirely (clean break, no fallback -- matches java-sdk/python-sdk)", () => {
      process.env.AGENTSPAN_SERVER_URL = "http://agentspan:9090";
      expect(resolveOrkesConfig({}).serverUrl).toBe("http://localhost:8080");
    });
  });

  // ─── Auth key/secret: no legacy fallback ────────────────────────────

  describe("auth key/secret", () => {
    it("CONDUCTOR_AUTH_KEY/SECRET win over explicit config", () => {
      process.env.CONDUCTOR_AUTH_KEY = "conductor-key";
      process.env.CONDUCTOR_AUTH_SECRET = "conductor-secret";
      const result = resolveOrkesConfig({ keyId: "explicit-key", keySecret: "explicit-secret" });
      expect(result.keyId).toBe("conductor-key");
      expect(result.keySecret).toBe("conductor-secret");
    });

    it("ignores legacy AGENTSPAN_AUTH_KEY/SECRET env vars entirely (clean break, no fallback -- matches java-sdk/python-sdk)", () => {
      process.env.AGENTSPAN_AUTH_KEY = "agentspan-key";
      process.env.AGENTSPAN_AUTH_SECRET = "agentspan-secret";
      const result = resolveOrkesConfig({});
      expect(result.keyId).toBeUndefined();
      expect(result.keySecret).toBeUndefined();
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
      // serverUrl defaults to localhost:8080 (spec R3) rather than undefined —
      // covered separately above.
      expect(result.keyId).toBeUndefined();
      expect(result.keySecret).toBeUndefined();
      expect(result.maxHttp2Connections).toBeUndefined();
      expect(result.logger).toBeUndefined();
      expect(result.tlsCertPath).toBeUndefined();
      expect(result.tlsKeyPath).toBeUndefined();
      expect(result.tlsCaPath).toBeUndefined();
      expect(result.proxyUrl).toBeUndefined();
      expect(result.tlsInsecure).toBeUndefined();
      expect(result.disableHttp2).toBeUndefined();
    });
  });

  // ─── Config value passthrough ──────────────────────────────────────

  describe("config passthrough", () => {
    it("should pass through logger from config", () => {
      const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
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

  // ─── Boolean env var parsing (tlsInsecure, disableHttp2) ──────────

  describe("boolean env var parsing", () => {
    it('should parse "true" as true for tlsInsecure', () => {
      process.env.CONDUCTOR_TLS_INSECURE = "true";
      expect(resolveOrkesConfig({}).tlsInsecure).toBe(true);
    });

    it('should parse "1" as true for tlsInsecure', () => {
      process.env.CONDUCTOR_TLS_INSECURE = "1";
      expect(resolveOrkesConfig({}).tlsInsecure).toBe(true);
    });

    it('should parse "TRUE" (case-insensitive) as true', () => {
      process.env.CONDUCTOR_TLS_INSECURE = "TRUE";
      expect(resolveOrkesConfig({}).tlsInsecure).toBe(true);
    });

    it('should parse "false" as false', () => {
      process.env.CONDUCTOR_TLS_INSECURE = "false";
      expect(resolveOrkesConfig({}).tlsInsecure).toBe(false);
    });

    it('should parse "0" as false', () => {
      process.env.CONDUCTOR_TLS_INSECURE = "0";
      expect(resolveOrkesConfig({}).tlsInsecure).toBe(false);
    });

    it("should fall back to config when env var is empty string", () => {
      process.env.CONDUCTOR_TLS_INSECURE = "";
      expect(resolveOrkesConfig({ tlsInsecure: true }).tlsInsecure).toBe(true);
    });

    it("should fall back to config when env var is not set", () => {
      expect(resolveOrkesConfig({ tlsInsecure: true }).tlsInsecure).toBe(true);
    });

    it("should prefer env var over config for tlsInsecure", () => {
      process.env.CONDUCTOR_TLS_INSECURE = "true";
      expect(resolveOrkesConfig({ tlsInsecure: false }).tlsInsecure).toBe(true);
    });

    it('should parse "true" as true for disableHttp2', () => {
      process.env.CONDUCTOR_DISABLE_HTTP2 = "true";
      expect(resolveOrkesConfig({}).disableHttp2).toBe(true);
    });

    it('should parse "1" as true for disableHttp2', () => {
      process.env.CONDUCTOR_DISABLE_HTTP2 = "1";
      expect(resolveOrkesConfig({}).disableHttp2).toBe(true);
    });

    it("should resolve disableHttp2 from config", () => {
      expect(resolveOrkesConfig({ disableHttp2: true }).disableHttp2).toBe(true);
    });

    it("should prefer env var over config for disableHttp2", () => {
      process.env.CONDUCTOR_DISABLE_HTTP2 = "true";
      expect(resolveOrkesConfig({ disableHttp2: false }).disableHttp2).toBe(true);
    });
  });
});

