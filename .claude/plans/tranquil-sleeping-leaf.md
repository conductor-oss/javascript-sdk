# Plan: Fix 8 Failing Integration Tests in WorkflowExecutor.test.ts

## Context

Integration tests ran: **20 passed, 2 failed** (286/295 tests pass). The 8 failures are all in the "Execute with Return Strategy and Consistency" describe block of `WorkflowExecutor.test.ts`. The 1 `ServiceRegistryClient.test.ts` failure is deferred.

**Root cause:** The 3 complex workflow definitions use HTTP tasks calling `http://httpbin:8081/api/hello?name=test1`. The `httpbin` hostname is a Docker service only available in Docker Compose environments. Locally, DNS fails → HTTP tasks fail → workflows FAIL → YIELD tasks never reached → signals can't work → `responseType` is `undefined`.

## Fix

Change `optional: false` → `optional: true` on the HTTP task in each of the 3 workflow metadata files. This lets workflows continue past failed HTTP tasks to reach YIELD tasks. The tests only care about signal/return strategy behavior, not HTTP results.

### Files to modify (1 line each)

1. **`src/integration-tests/metadata/complex_wf_signal_test.ts`** line 25
2. **`src/integration-tests/metadata/complex_wf_signal_test_subworkflow_1.ts`** line 25
3. **`src/integration-tests/metadata/complex_wf_signal_test_subworkflow_2.ts`** line 25

Only the HTTP tasks get `optional: true`. YIELD and SUB_WORKFLOW tasks remain `optional: false`.

Add a comment: `// optional so tests work without httpbin Docker service`

## Why this is safe

- When httpbin IS available (CI/Docker): HTTP task succeeds normally, `optional: true` has no effect
- When httpbin is NOT available (local): HTTP task fails gracefully, workflow continues
- No other tests reference these metadata files
- Test assertions check workflow/task fields that are still populated regardless of HTTP task status

## Verification

```bash
npm run test:integration:orkes-v5 -- --testPathPatterns=WorkflowExecutor
```

All 8 previously-failing tests should pass. Then re-run full suite to confirm no regressions.
