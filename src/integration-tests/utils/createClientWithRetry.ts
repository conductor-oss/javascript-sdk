import type { Client } from "../../open-api";
import { orkesConductorClient } from "../../sdk";

/**
 * Create a Conductor client with retries. Use in integration test beforeAll to
 * tolerate transient auth/503 failures in CI.
 */
export async function createClientWithRetry(
  maxAttempts = 5,
  initialDelayMs = 2000
): Promise<Client> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await orkesConductorClient();
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts) break;
      const backoffMs = initialDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 500;
      console.warn(
        `createClientWithRetry failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(backoffMs + jitter)}ms...`
      );
      await new Promise((r) => setTimeout(r, backoffMs + jitter));
    }
  }
  throw lastError;
}
