# Reliability: timeouts, retries, idempotency, and domains

Set poll, response, and execution timeouts on every task definition. Retry
only idempotent or compensated work; use `domain` to route resource-bound
work to isolated worker pools.

```typescript
@worker({ taskDefName: "validate_order" })
async function validateOrder(task: Task) {
  const order = await getOrder(task.inputData.orderId);
  if (!order) {
    throw new NonRetryableException("Order not found"); // FAILED_WITH_TERMINAL_ERROR
  }
  return { status: "COMPLETED" as const, outputData: { validated: true } };
}
```

A worker may receive the same task more than once. Persist idempotency keys
before external side effects. Long-running tasks should return `IN_PROGRESS`
with `setCallbackAfter`/lease extension (see
[LEASE_EXTENSION.md](../LEASE_EXTENSION.md)) rather than blocking the poll
loop. `retryServerErrors`/`CONDUCTOR_RETRY_SERVER_ERRORS` opts idempotent
HTTP methods into retrying transient 502/503/504 responses from the server
itself.

Verify behavior with failure-path tests
([workflow testing](workflow-testing.md)) and inspect task
`reasonForIncompletion` before retrying — see [debugging](debugging.md).
