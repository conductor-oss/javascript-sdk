# Breaking Changes

## v3.x (Worker Architecture Parity Release)

### `TaskHandler.startWorkers()` is now `async`

**Change:** `startWorkers(): void` → `startWorkers(): Promise<void>`

**Why:** `startWorkers()` now registers task definitions (via `registerTaskDef: true`) before starting the polling loop. This requires async API calls to the Conductor server.

**Impact:**

| Scenario | Before | After | Breaks? |
|----------|--------|-------|---------|
| `handler.startWorkers()` (fire-and-forget) | Works | Works — promise created, workers start, task def registration runs in background | **No** |
| `await handler.startWorkers()` | TypeScript error (void not awaitable) | Works — waits for task def registration to complete before returning | **No** |
| `const r: void = handler.startWorkers()` | `r` is `void` | TypeScript error — `r` is `Promise<void>` | **Yes (type-level only)** |

**Migration:** Add `await` before `handler.startWorkers()` to get the full benefit of task definition registration. Without `await`, everything still works — workers start immediately, and task definition registration completes asynchronously in the background. The only scenario that breaks is explicit `void` type annotation on the return value.

```typescript
// Before (still works, no change needed)
handler.startWorkers();

// Recommended (ensures task defs are registered before polling)
await handler.startWorkers();
```

---

### `ConductorWorker.execute` return type widened

**Change:** `execute` return type expanded from `Promise<Omit<TaskResult, ...>>` to `Promise<Omit<TaskResult, ...> | TaskInProgressResult>`.

**Impact:** Existing workers returning `{ status: "COMPLETED", outputData: {...} }` continue to work unchanged. The new `TaskInProgressResult` type (`{ status: "IN_PROGRESS", callbackAfterSeconds: number }`) is an additive option for long-running tasks.

**Breaks?** No — union types are backward compatible. Existing code compiles and runs without changes.
