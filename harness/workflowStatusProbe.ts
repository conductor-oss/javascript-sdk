import type { Client } from "../src/open-api/generated/client";
import { WorkflowResource } from "../src/open-api/generated";

const MAX_TRACKED_IDS = 256;

/**
 * Exercises UUID-bearing workflow lookup endpoints so
 * http_api_client_request_seconds picks up entries with
 * uri=/workflow/{workflowId} and uri=/workflow/{workflowId}/tasks.
 *
 * Default harness traffic only hits bounded, no-path-param URLs (poll/update),
 * making the high-cardinality concern on the uri label invisible without this
 * probe.
 *
 * Default off. Runs only when HARNESS_PROBE_RATE_PER_SEC > 0.
 * Side-effect-free: only issues read calls (getExecutionStatus,
 * getExecutionStatusTaskList).
 * Self-bounded: fixed-size FIFO of workflow IDs.
 */
export class WorkflowStatusProbe {
  private readonly client: Client;
  private readonly callsPerSecond: number;
  private readonly recentIDs: string[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(client: Client, callsPerSecond: number) {
    this.client = client;
    this.callsPerSecond = callsPerSecond;
  }

  offer(workflowId: string): void {
    if (!workflowId) return;
    this.recentIDs.push(workflowId);
    if (this.recentIDs.length > MAX_TRACKED_IDS) {
      this.recentIDs.splice(0, this.recentIDs.length - MAX_TRACKED_IDS);
    }
  }

  start(): void {
    if (this.callsPerSecond <= 0) {
      console.log(
        "WorkflowStatusProbe disabled (HARNESS_PROBE_RATE_PER_SEC<=0)",
      );
      return;
    }
    console.log(
      `WorkflowStatusProbe started: rate=${this.callsPerSecond}/sec, retainedIds<=${MAX_TRACKED_IDS}`,
    );

    this.timer = setInterval(() => {
      this.tick();
    }, 1000);

    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    console.log("WorkflowStatusProbe stopped");
  }

  private tick(): void {
    const budget = Math.min(this.callsPerSecond, this.recentIDs.length);
    if (budget === 0) return;

    const ids: string[] = [];
    for (let i = 0; i < budget; i++) {
      ids.push(
        this.recentIDs[Math.floor(Math.random() * this.recentIDs.length)],
      );
    }

    for (const id of ids) {
      const call =
        Math.random() < 0.5
          ? WorkflowResource.getExecutionStatus({
              client: this.client,
              path: { workflowId: id },
            })
          : WorkflowResource.getExecutionStatusTaskList({
              client: this.client,
              path: { workflowId: id },
            });

      call.catch((err: unknown) => {
        console.error(
          `probe: ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }
}
