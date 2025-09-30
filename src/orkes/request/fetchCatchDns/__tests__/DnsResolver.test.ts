import { expect, describe, test } from "@jest/globals";
import { dnsResolver } from "../DnsResolver";

const sampleDomain = "orkes.io";
const nonExistingDomain = "non-existing-domain.orkesdemo.io";

describe("dnsResolver", () => {
  test("should resolve dns", async () => {
    const ip = await dnsResolver(sampleDomain);
    expect(ip).toBeDefined();
  });
  test("Should return empty if domain could not be resolved", async () => {
    const ip = await dnsResolver(nonExistingDomain);
    expect(ip).not.toBeDefined();
  });
});
