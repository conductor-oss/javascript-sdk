import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { MetricsCollector } from "./MetricsCollector";

/**
 * Lightweight HTTP server exposing Prometheus metrics and a health check endpoint.
 *
 * Uses Node.js built-in `http` module — no external dependencies.
 *
 * Endpoints:
 * - `GET /metrics` — Prometheus text exposition format (`text/plain; version=0.0.4`)
 * - `GET /health` — JSON health check (`{"status":"UP"}`)
 *
 * @example
 * ```typescript
 * const collector = new MetricsCollector();
 * const server = new MetricsServer(collector, 9090);
 * await server.start();
 * // GET http://localhost:9090/metrics
 * // GET http://localhost:9090/health
 * await server.stop();
 * ```
 */
export class MetricsServer {
  private readonly _collector: MetricsCollector;
  private readonly _port: number;
  private _server?: Server;

  constructor(collector: MetricsCollector, port: number) {
    this._collector = collector;
    this._port = port;
  }

  /** Start listening on the configured port */
  async start(): Promise<void> {
    if (this._server) return;

    this._server = createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === "GET" && req.url === "/metrics") {
          void this._collector.toPrometheusTextAsync().then((body) => {
            res.writeHead(200, {
              "Content-Type": this._collector.getContentType(),
            });
            res.end(body);
          });
          return;
        } else if (req.method === "GET" && req.url === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "UP" }));
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
      }
    );

    return new Promise<void>((resolve, reject) => {
      this._server!.on("error", reject);
      this._server!.listen(this._port, () => resolve());
    });
  }

  /** Stop the HTTP server */
  async stop(): Promise<void> {
    if (!this._server) return;

    return new Promise<void>((resolve, reject) => {
      this._server!.close((err) => {
        this._server = undefined;
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
