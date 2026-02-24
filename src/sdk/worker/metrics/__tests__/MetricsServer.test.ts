import { describe, it, expect, afterEach } from "@jest/globals";
import { get as httpGet } from "node:http";
import { MetricsCollector } from "../MetricsCollector";
import { MetricsServer } from "../MetricsServer";

function fetchHttp(url: string): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    httpGet(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          body,
          headers: res.headers as Record<string, string | string[] | undefined>,
        })
      );
      res.on("error", reject);
    }).on("error", reject);
  });
}

// Use unique ports to avoid test interference
let portCounter = 19870;
function nextPort() {
  return portCounter++;
}

describe("MetricsServer", () => {
  let server: MetricsServer | undefined;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = undefined;
    }
  });

  it("should serve /metrics with Prometheus text format", async () => {
    const port = nextPort();
    const collector = new MetricsCollector();
    collector.onPollStarted({ taskType: "test_task", workerId: "w", pollCount: 1, timestamp: new Date() });

    server = new MetricsServer(collector, port);
    await server.start();

    const res = await fetchHttp(`http://localhost:${port}/metrics`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("task_poll_total");
  });

  it("should serve /health with JSON status", async () => {
    const port = nextPort();
    const collector = new MetricsCollector();
    server = new MetricsServer(collector, port);
    await server.start();

    const res = await fetchHttp(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "UP" });
  });

  it("should return 404 for unknown paths", async () => {
    const port = nextPort();
    const collector = new MetricsCollector();
    server = new MetricsServer(collector, port);
    await server.start();

    const res = await fetchHttp(`http://localhost:${port}/unknown`);
    expect(res.status).toBe(404);
  });

  it("should stop cleanly after start", async () => {
    const port = nextPort();
    const collector = new MetricsCollector();
    server = new MetricsServer(collector, port);
    await server.start();
    await server.stop();
    server = undefined;
  });

  it("should not throw when stop() called without start()", async () => {
    const collector = new MetricsCollector();
    server = new MetricsServer(collector, nextPort());
    await server.stop();
    server = undefined;
  });

  it("should not throw when start() called twice", async () => {
    const port = nextPort();
    const collector = new MetricsCollector();
    server = new MetricsServer(collector, port);
    await server.start();
    await server.start(); // second call should be a no-op

    const res = await fetchHttp(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
  });
});
