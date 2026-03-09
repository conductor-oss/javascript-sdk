import type { Client } from "../../open-api";
import { orkesConductorClient } from "../../sdk";

/**
 * Create a Conductor client with retries. Use in integration test beforeAll to
 * tolerate transient auth/503 failures in CI.
 */
export async function createClientWithRetry(
  maxAttempts = 3,
  delayMs = 2000
): Promise<Client> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await orkesConductorClient();
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastError;
}
