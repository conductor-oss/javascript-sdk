# Deployment, scaling, and graceful shutdown

Run `TaskHandler`/worker processes and `AgentRuntime.serve()` as long-lived
Node.js services — containers, VMs, or any process manager. Do not construct
a new client/runtime per request; reuse them for the application's lifetime.

```typescript
process.on("SIGTERM", async () => {
  await handler.stopWorkers();
  process.exit(0);
});
```

Scale by adding worker instances (each polls independently) and use
`concurrency`/`domain` to isolate or parallelize specific task types rather
than the whole process. On shutdown, stop task handlers and runtimes so
in-flight tasks are redelivered instead of abandoned — see
[reliability](reliability.md) for timeout/retry policy that governs
redelivery.
