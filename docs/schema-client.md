# Schema client

**Audience:** developers enforcing input and output schemas on tasks and
workflows.

## Prerequisites

A client ([connection-authentication.md](connection-authentication.md)) and a
server that supports the schema API.

**Capability:** schema enforcement is a server feature. Registering a schema against
a server that doesn't support it fails; check
[compatibility.md](compatibility.md).

## Registering a schema

```ts
const schemas = clients.getSchemaClient();

await schemas.saveSchema({
  name: "order_input",
  version: 1,
  type: "JSON",
  data: {
    type: "object",
    properties: {
      orderId: { type: "string" },
      amount: { type: "number", minimum: 0 },
    },
    required: ["orderId", "amount"],
  },
});
```

**Expected result:** `getSchema("order_input", 1)` returns the definition, and a
task or workflow referencing it validates input on the server.

Schemas are **versioned**. Saving the same name with a new version adds a version
rather than replacing one, so existing definitions pinned to version 1 keep
validating against version 1.

## Attaching to a task definition

```ts
await clients.getMetadataClient().registerTask({
  name: "process_order",
  inputSchema: { name: "order_input", version: 1, type: "JSON" },
  responseTimeoutSeconds: 60,
});
```

The server rejects a task whose input fails validation before your worker ever sees
it — which is the point: bad input fails fast and visibly rather than inside your
handler.

## Generating schemas from TypeScript

The worker framework can generate JSON Schema from decorated classes:

```ts
import { jsonSchema, schemaField } from "@io-orkes/conductor-javascript";

@jsonSchema({ name: "order_input" })
class OrderInput {
  @schemaField({ type: "string" })
  orderId!: string;

  @schemaField({ type: "number", minimum: 0 })
  amount!: number;
}
```

For agents, `outputType` accepts a Zod schema or a plain JSON Schema object and is
converted for you — see
[agents/concepts/structured-output.md](agents/concepts/structured-output.md).

## Common failure modes

- **A schema change appearing to have no effect.** The task definition pins a
  version. Bump the version *and* update the definition's reference.
- **Validation not firing.** The task definition has no `inputSchema` reference —
  registering the schema alone does nothing.
- **A rejected task with no worker log.** Rejection happens server-side, before
  dispatch. Look at the execution, not the worker.

## Agent configuration contract

The agent layer has its own contract — the serialized agent config — documented and
validated separately at
[agents/reference/agent-schema.md](agents/reference/agent-schema.md), with a
machine-readable
[agent-schema.json](agents/reference/agent-schema.json) checked in CI.

## Next steps

[workflows.md](workflows.md) · [workflow-testing.md](workflow-testing.md) ·
[api-map.md](api-map.md)
