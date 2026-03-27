import type { WorkflowExecutor } from "../src/sdk/clients/workflow/WorkflowExecutor";

export class WorkflowGovernor {
  private readonly workflowExecutor: WorkflowExecutor;
  private readonly workflowName: string;
  private readonly workflowsPerSecond: number;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    workflowExecutor: WorkflowExecutor,
    workflowName: string,
    workflowsPerSecond: number,
  ) {
    this.workflowExecutor = workflowExecutor;
    this.workflowName = workflowName;
    this.workflowsPerSecond = workflowsPerSecond;
  }

  start(): void {
    console.log(
      `WorkflowGovernor started: workflow=${this.workflowName}, rate=${this.workflowsPerSecond}/sec`,
    );

    this.timer = setInterval(() => {
      this.startBatch();
    }, 1000);

    // Don't prevent process exit
    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    console.log("WorkflowGovernor stopped");
  }

  private startBatch(): void {
    const promises: Promise<string>[] = [];
    for (let i = 0; i < this.workflowsPerSecond; i++) {
      promises.push(
        this.workflowExecutor.startWorkflow({
          name: this.workflowName,
          version: 1,
        }),
      );
    }

    Promise.all(promises)
      .then(() => {
        console.log(
          `Governor: started ${this.workflowsPerSecond} workflow(s)`,
        );
      })
      .catch((err: unknown) => {
        console.error(
          `Governor: error starting workflows: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }
}
