import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { AgentClient, decodeJwtExp } from "../../sdk/clients/agent/AgentClient.js";

/** Build a minimal JWT with the given `exp` (epoch seconds). */
function makeJwt(exp: number): string {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "");
  return `${b64({ alg: "none" })}.${b64({ exp })}.sig`;
}

describe("decodeJwtExp", () => {
  it("decodes exp claim", () => {
    expect(decodeJwtExp(makeJwt(1234567890))).toBe(1234567890);
  });
  it("returns 0 for a non-JWT string", () => {
    expect(decodeJwtExp("not-a-jwt")).toBe(0);
  });
});

describe("AgentClient auth headers (Orkes JWT)", () => {
  let realFetch: typeof globalThis.fetch;

  beforeEach(() => {
    realFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it("mints a JWT from keyId/keySecret and sends X-Authorization; caches/reuses it", async () => {
    const client = new AgentClient({
      serverUrl: "http://localhost:8080/api",
      authKey: "KEY",
      authSecret: "SECRET",
    });

    // Stub the Conductor client so getClient() never touches the network.
    const generateToken = jest
      .fn()
      .mockResolvedValue({ token: makeJwt(Math.floor(Date.now() / 1000) + 3600) });
    jest.spyOn(client, "getClient").mockResolvedValue({
      tokenResource: { generateToken },
    } as never);

    // Capture the headers each /agent/* request carries.
    const seen: Headers[] = [];
    const fetchMock = jest.fn(async (_url: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return new Response(JSON.stringify({ executionId: "exec-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const r1 = await client.startAgent({ prompt: "hi" });
    const r2 = await client.startAgent({ prompt: "again" });

    expect(r1.executionId).toBe("exec-1");
    expect(r2.executionId).toBe("exec-1");

    // Both requests carry the minted JWT as X-Authorization (not X-Auth-Key).
    expect(seen).toHaveLength(2);
    for (const h of seen) {
      expect(h.get("x-authorization")).toMatch(/^[\w-]+\.[\w-]+\.sig$/);
      expect(h.get("x-auth-key")).toBeNull();
      expect(h.get("x-auth-secret")).toBeNull();
      expect(h.get("authorization")).toBeNull();
    }

    // Token is minted once and reused (cached until ~expiry).
    expect(generateToken).toHaveBeenCalledTimes(1);
    expect(generateToken).toHaveBeenCalledWith({ keyId: "KEY", keySecret: "SECRET" });
  });

  it("uses an explicit apiKey verbatim as X-Authorization (no minting)", async () => {
    const client = new AgentClient({
      serverUrl: "http://localhost:8080/api",
      apiKey: "explicit-token",
    });
    const generateToken = jest.fn();
    jest.spyOn(client, "getClient").mockResolvedValue({
      tokenResource: { generateToken },
    } as never);

    let captured: Headers | undefined;
    globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      captured = new Headers(init?.headers);
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    await client.startAgent({ prompt: "hi" });
    expect(captured?.get("x-authorization")).toBe("explicit-token");
    expect(generateToken).not.toHaveBeenCalled();
  });

  it("COUNTERFACTUAL: no creds → no auth header", async () => {
    const client = new AgentClient({ serverUrl: "http://localhost:8080/api" });
    // getClient must NOT be needed for the anonymous path.
    const getClientSpy = jest.spyOn(client, "getClient");

    let captured: Headers | undefined;
    globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      captured = new Headers(init?.headers);
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    await client.startAgent({ prompt: "hi" });
    expect(captured?.get("x-authorization")).toBeNull();
    expect(captured?.get("x-auth-key")).toBeNull();
    expect(getClientSpy).not.toHaveBeenCalled();
  });
});
