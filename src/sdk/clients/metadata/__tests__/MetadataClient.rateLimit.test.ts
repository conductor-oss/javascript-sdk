import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { MetadataClient } from "../MetadataClient";
import type { Client } from "../../../../open-api";

function createMockClient(): Client {
  const mockFn = jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data: null });
  return {
    buildUrl: jest.fn(),
    getConfig: jest.fn(),
    request: jest.fn(),
    setConfig: jest.fn(),
    get: mockFn as unknown as Client["get"],
    post: mockFn as unknown as Client["post"],
    put: mockFn as unknown as Client["put"],
    patch: mockFn as unknown as Client["patch"],
    delete: mockFn as unknown as Client["delete"],
    head: mockFn as unknown as Client["head"],
    options: mockFn as unknown as Client["options"],
    trace: mockFn as unknown as Client["trace"],
  } as unknown as Client;
}

describe("MetadataClient - Rate Limit CRUD", () => {
  let client: Client;
  let metadataClient: MetadataClient;

  beforeEach(() => {
    client = createMockClient();
    metadataClient = new MetadataClient(client);
  });

  describe("setWorkflowRateLimit()", () => {
    it("should call PUT with correct URL and body", async () => {
      const config = { rateLimitKey: "order_flow", concurrentExecLimit: 10 };
      await metadataClient.setWorkflowRateLimit(config, "order_flow");

      expect(client.put).toHaveBeenCalledTimes(1);
      const callArgs = (client.put as jest.MockedFunction<typeof client.put>).mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.url).toBe("/api/metadata/workflow/order_flow/rate-limit");
      expect(callArgs.body).toEqual(config);
    });

    it("should encode workflow name in URL", async () => {
      await metadataClient.setWorkflowRateLimit({}, "my flow/v2");

      const callArgs = (client.put as jest.MockedFunction<typeof client.put>).mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.url).toBe("/api/metadata/workflow/my%20flow%2Fv2/rate-limit");
    });
  });

  describe("getWorkflowRateLimit()", () => {
    it("should call GET with correct URL and return data", async () => {
      const expected = { rateLimitKey: "test", concurrentExecLimit: 5 };
      (client.get as jest.MockedFunction<typeof client.get>).mockResolvedValueOnce({
        data: expected,
      } as never);

      const result = await metadataClient.getWorkflowRateLimit("test_flow");

      expect(client.get).toHaveBeenCalledTimes(1);
      const callArgs = (client.get as jest.MockedFunction<typeof client.get>).mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.url).toBe("/api/metadata/workflow/test_flow/rate-limit");
      expect(result).toEqual(expected);
    });

    it("should return undefined on 404", async () => {
      const error = { status: 404, message: "Not found" };
      (client.get as jest.MockedFunction<typeof client.get>).mockRejectedValueOnce(error as never);

      const result = await metadataClient.getWorkflowRateLimit("no_limit_flow");
      expect(result).toBeUndefined();
    });

    it("should throw on non-404 errors", async () => {
      const error = { status: 500, message: "Server error" };
      (client.get as jest.MockedFunction<typeof client.get>).mockRejectedValueOnce(error as never);

      await expect(metadataClient.getWorkflowRateLimit("error_flow")).rejects.toThrow();
    });
  });

  describe("removeWorkflowRateLimit()", () => {
    it("should call DELETE with correct URL", async () => {
      await metadataClient.removeWorkflowRateLimit("order_flow");

      expect(client.delete).toHaveBeenCalledTimes(1);
      const callArgs = (client.delete as jest.MockedFunction<typeof client.delete>).mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.url).toBe("/api/metadata/workflow/order_flow/rate-limit");
    });
  });
});
