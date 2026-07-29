# Workflow testing

**Audience:** developers testing workflows, workers, and agents.

## Prerequisites

The repository uses Jest. Unit tests need no server; integration tests need a
running one ([server-setup.md](server-setup.md)).

## Test tiers

| Tier | Command | Needs a server |
|---|---|---|
| Unit | `npm run test:unit` | No |
| Integration (v5 sdkdev) | `npm run test:integration:v5` | Yes |
| Integration (v4 sm) | `npm run test:integration:v4` | Yes |
| Integration (OSS) | `npm run test:integration:oss` | Yes — local Docker stack |
| Agent e2e | `npm run test:agent-e2e` | Yes — plus LLM keys on the server |

CI runs unit tests across Node 20, 22, and 24, and shards the integration suites.

## Unit-testing a worker

A worker is a plain function. Test it directly — no server, no polling:

```ts
import { greet } from "../src/workers/greet";

it("greets by name", async () => {
  const result = await greet({ inputData: { name: "Ada" } } as never);
  expect(result.outputData?.result).toBe("Hello Ada");
});
```

**Expected result:** a fast test with no I/O. This is the highest-value tier —
worker logic is where most bugs live, and none of it needs Conductor.

## Testing a workflow definition

`runtime.plan(agent)` for agents, or building the workflow and inspecting it,
lets you assert on the compiled definition without executing:

```ts
const definition = await runtime.plan(agent);
expect(definition.tasks).toHaveLength(3);
```

This catches "the definition changed shape" regressions cheaply, and is the right
place to pin behavior you care about that would otherwise need a live run.

## Agent testing toolkit

The `/agents/testing` subpath provides assertion and mocking helpers so agent tests
don't require a live model:

```ts
import { mockAgent, expectAgent } from "@io-orkes/conductor-javascript/agents/testing";
```

## Integration tests

Local OSS stack, the same one CI uses:

```shell
docker compose -f scripts/docker-compose-oss.yaml up -d
./scripts/run-integration-oss.sh
```

Orkes-only tests are gated out via `CONDUCTOR_SERVER_TYPE=oss`, so the OSS run
skips capabilities a standalone server lacks rather than failing.

**Cleanup:**

```shell
docker compose -f scripts/docker-compose-oss.yaml down -v
```

## Common failure modes

- **Integration test hangs.** Workers weren't started before the workflow executed,
  or a `taskDefName` doesn't match. See [debugging.md](debugging.md).
- **Test passes alone, fails in a suite.** Shared server state. Integration tests
  run with `--runInBand` for this reason; give each test unique workflow and task
  names.
- **A test leaves the process open.** `stopWorkers()` / `runtime.shutdown()` in
  `afterEach`. Jest is run with `--force-exit` here to contain it, which hides the
  leak rather than fixing it.
- **Dynamic `import()` in a test.** It breaks under Jest in this repo; use static
  imports.

## Doc validation

Documentation is validated in CI: internal Markdown links, retired references, and
the agent configuration schema.

```shell
npm run verify:agent-schema
```

## Next steps

[debugging.md](debugging.md) · [workers.md](workers.md) ·
[compatibility.md](compatibility.md)
