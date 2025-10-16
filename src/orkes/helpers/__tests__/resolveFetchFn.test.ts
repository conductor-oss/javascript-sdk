import { expect, describe, it } from "@jest/globals";
import { resolveFetchFn } from "../resolveFetchFn";

describe("resolveFetchFn", () => {
  it("should return undici fetch on Node.js v20+ and default fetch on Node.js v18", async () => {
    const majorNodeVersion = parseInt(process.version.slice(1).split(".")[0]);
    const fetchFn = await resolveFetchFn();

    majorNodeVersion >= 20
      ? expect(fetchFn.toString().includes("undiciFetch")).toBe(true)
      : expect(fetchFn).toBe(fetch);
  });

  it("should return custom fetch if provided", async () => {
    const customFetch = async () => new Response("test");
    const customFetchFn = await resolveFetchFn(customFetch);
    expect(customFetchFn).toBe(customFetch);
  });
});
