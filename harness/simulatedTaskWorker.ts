import crypto from "crypto";
import type { Task, TaskResult } from "../src/open-api";

const ALPHANUMERIC_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const instanceId: string =
  process.env.HOSTNAME ?? crypto.randomBytes(4).toString("hex");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Type-safe input helpers ──────────────────────────────────────

function toInt(v: unknown): number {
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function toFloat(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function toBool(v: unknown): { value: boolean; ok: boolean } {
  if (typeof v === "boolean") return { value: v, ok: true };
  if (typeof v === "string") {
    const lower = v.toLowerCase();
    if (lower === "true" || lower === "1") return { value: true, ok: true };
    if (lower === "false" || lower === "0") return { value: false, ok: true };
  }
  if (typeof v === "number") return { value: v !== 0, ok: true };
  return { value: false, ok: false };
}

function getIntOrDefault(
  input: Record<string, unknown>,
  key: string,
  defaultVal: number,
): number {
  const v = input[key];
  if (v == null) return defaultVal;
  return toInt(v);
}

function getFloatOrDefault(
  input: Record<string, unknown>,
  key: string,
  defaultVal: number,
): number {
  const v = input[key];
  if (v == null) return defaultVal;
  return toFloat(v);
}

function getStringOrDefault(
  input: Record<string, unknown>,
  key: string,
  defaultVal: string,
): string {
  const v = input[key];
  if (v == null) return defaultVal;
  if (typeof v === "string") return v;
  return defaultVal;
}

function getBoolOrDefault(
  input: Record<string, unknown>,
  key: string,
  defaultVal: boolean,
): boolean {
  const v = input[key];
  if (v == null) return defaultVal;
  const result = toBool(v);
  return result.ok ? result.value : defaultVal;
}

function generateRandomData(size: number): string {
  if (size <= 0) return "";
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buf[i] = ALPHANUMERIC_CHARS.charCodeAt(
      Math.floor(Math.random() * ALPHANUMERIC_CHARS.length),
    );
  }
  return buf.toString("ascii");
}

// ── SimulatedTaskWorker ──────────────────────────────────────────

export class SimulatedTaskWorker {
  readonly taskName: string;
  readonly codename: string;
  readonly defaultDelayMs: number;
  readonly batchSize: number;
  readonly pollInterval: number;
  readonly workerId: string;

  constructor(
    taskName: string,
    codename: string,
    sleepSeconds: number,
    batchSize = 5,
    pollIntervalMs = 1000,
  ) {
    this.taskName = taskName;
    this.codename = codename;
    this.defaultDelayMs = sleepSeconds * 1000;
    this.batchSize = batchSize;
    this.pollInterval = pollIntervalMs;
    this.workerId = `${taskName}-${instanceId}`;

    console.log(
      `[${this.taskName}] Initialized worker [workerId=${this.workerId}, codename=${this.codename}, batchSize=${this.batchSize}, pollInterval=${pollIntervalMs}ms]`,
    );
  }

  async execute(
    task: Task,
  ): Promise<Omit<TaskResult, "workflowInstanceId" | "taskId">> {
    const input = (task.inputData as Record<string, unknown>) ?? {};
    const taskId = task.taskId ?? "";
    const taskIndex = getIntOrDefault(input, "taskIndex", -1);

    console.log(
      `[${this.taskName}] Starting simulated task [id=${taskId}, index=${taskIndex}, codename=${this.codename}]`,
    );

    const startTime = Date.now();

    const delayType = getStringOrDefault(input, "delayType", "fixed");
    const minDelay = getIntOrDefault(input, "minDelay", this.defaultDelayMs);
    const maxDelay = getIntOrDefault(input, "maxDelay", minDelay + 100);
    const meanDelay = getIntOrDefault(
      input,
      "meanDelay",
      Math.trunc((minDelay + maxDelay) / 2),
    );
    const stdDeviation = getIntOrDefault(input, "stdDeviation", 30);
    const successRate = getFloatOrDefault(input, "successRate", 1.0);
    const failureMode = getStringOrDefault(input, "failureMode", "random");
    const outputSize = getIntOrDefault(input, "outputSize", 1024);

    let delayMs = 0;
    if (delayType.toLowerCase() !== "wait") {
      delayMs = this.calculateDelay(
        delayType,
        minDelay,
        maxDelay,
        meanDelay,
        stdDeviation,
      );

      console.log(
        `[${this.taskName}] Simulated task [id=${taskId}, index=${taskIndex}] sleeping for ${delayMs} ms`,
      );
      await sleep(delayMs);
    }

    if (!this.shouldTaskSucceed(successRate, failureMode, input)) {
      console.log(
        `[${this.taskName}] Simulated task [id=${taskId}, index=${taskIndex}] failed as configured`,
      );
      return {
        status: "FAILED",
        outputData: {
          error: "Simulated task failure based on configuration",
        },
      };
    }

    const elapsed = Date.now() - startTime;
    const output = this.generateOutput(
      input,
      taskId,
      taskIndex,
      delayMs,
      elapsed,
      outputSize,
    );

    return { status: "COMPLETED", outputData: output };
  }

  // ── Delay calculation ──────────────────────────────────────────

  private calculateDelay(
    delayType: string,
    minDelay: number,
    maxDelay: number,
    meanDelay: number,
    stdDeviation: number,
  ): number {
    switch (delayType.toLowerCase()) {
      case "fixed":
        return minDelay;

      case "random": {
        const spread = Math.max(1, maxDelay - minDelay + 1);
        return minDelay + Math.floor(Math.random() * spread);
      }

      case "normal": {
        const gaussian = this.nextGaussian();
        const delay = Math.round(meanDelay + gaussian * stdDeviation);
        return Math.max(1, delay);
      }

      case "exponential": {
        const exp = -meanDelay * Math.log(1 - Math.random());
        return Math.max(minDelay, Math.min(maxDelay, Math.trunc(exp)));
      }

      default:
        return minDelay;
    }
  }

  /** Box-Muller transform */
  private nextGaussian(): number {
    const u1 = 1.0 - Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  }

  // ── Failure simulation ─────────────────────────────────────────

  private shouldTaskSucceed(
    successRate: number,
    failureMode: string,
    input: Record<string, unknown>,
  ): boolean {
    if (input.forceSuccess != null) {
      const result = toBool(input.forceSuccess);
      if (result.ok) return result.value;
    }
    if (input.forceFail != null) {
      const result = toBool(input.forceFail);
      if (result.ok) return !result.value;
    }

    switch (failureMode.toLowerCase()) {
      case "random":
        return Math.random() < successRate;

      case "conditional":
        return this.shouldConditionalSucceed(successRate, input);

      case "sequential": {
        const attempt = getIntOrDefault(input, "attempt", 1);
        const failUntilAttempt = getIntOrDefault(
          input,
          "failUntilAttempt",
          2,
        );
        return attempt >= failUntilAttempt;
      }

      default:
        return Math.random() < successRate;
    }
  }

  private shouldConditionalSucceed(
    successRate: number,
    input: Record<string, unknown>,
  ): boolean {
    const taskIndex = getIntOrDefault(input, "taskIndex", -1);
    if (taskIndex >= 0) {
      if (Array.isArray(input.failIndexes)) {
        for (const idx of input.failIndexes) {
          if (toInt(idx) === taskIndex) return false;
        }
      }
      const failEvery = getIntOrDefault(input, "failEvery", 0);
      if (failEvery > 0 && taskIndex % failEvery === 0) return false;
    }
    return Math.random() < successRate;
  }

  // ── Output generation ──────────────────────────────────────────

  private generateOutput(
    input: Record<string, unknown>,
    taskId: string,
    taskIndex: number,
    delayMs: number,
    elapsedTimeMs: number,
    outputSize: number,
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {
      taskId,
      taskIndex,
      codename: this.codename,
      status: "completed",
      configuredDelayMs: delayMs,
      actualExecutionTimeMs: elapsedTimeMs,
      a_or_b: Math.floor(Math.random() * 100) > 20 ? "a" : "b",
      c_or_d: Math.floor(Math.random() * 100) > 33 ? "c" : "d",
    };

    if (getBoolOrDefault(input, "includeInput", false)) {
      output.input = input;
    }

    if (input.previousTaskOutput != null) {
      output.previousTaskData = input.previousTaskOutput;
    }

    if (outputSize > 0) {
      output.data = generateRandomData(outputSize);
    }

    if (
      input.outputTemplate != null &&
      typeof input.outputTemplate === "object" &&
      !Array.isArray(input.outputTemplate)
    ) {
      const template = input.outputTemplate as Record<string, unknown>;
      for (const [k, v] of Object.entries(template)) {
        output[k] = v;
      }
    }

    return output;
  }
}
