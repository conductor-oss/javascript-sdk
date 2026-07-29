# Metrics and logging

Enable Prometheus metrics with the built-in collector and configure log
verbosity with `CONDUCTOR_LOG_LEVEL`:

```typescript
import { createMetricsCollector, MetricsServer, TaskHandler } from "@io-orkes/conductor-javascript";

const metrics = createMetricsCollector();
await new MetricsServer(metrics, 9090).start();

const handler = new TaskHandler({ client, eventListeners: [metrics], scanForDecorated: true });
await handler.startWorkers();
// GET http://localhost:9090/metrics — Prometheus text format
```

Two metric surfaces exist: **legacy** (default) and **canonical** (opt-in via
`WORKER_CANONICAL_METRICS=true`, unprefixed Histogram-based names, bounded
`uri` labels). See [METRICS.md](../METRICS.md) for the full catalog and
migration guide.

For agent executions, inspect the shared workflow record
([agents/reference/client.md](agents/reference/client.md)) for inputs,
outputs, tool calls, retries, and status. Avoid logging credentials or
unredacted sensitive data.
