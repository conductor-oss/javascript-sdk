# Schema client

`SchemaClient` (`OrkesClients.getSchemaClient()`) manages versioned schema
definitions through the Conductor schema API — `registerSchema`, `getSchema`,
`getAllSchemas`, `deleteSchema`.

```typescript
const schemas = clients.getSchemaClient();
await schemas.registerSchema([{ name: "order", type: "JSON", version: 1, data: {} }]);
```

**OSS/Orkes:** availability depends on the server deployment and
permissions. Validate schemas in a non-production environment before making
them required by workers or tasks.

There is no dedicated `schema-client.md` API reference page yet (tracked in
[documentation-parity.md](documentation-parity.md#js-only-by-design-pages));
see the [schemas API journey example](../examples/api-journeys/schemas.ts)
for a runnable walkthrough of every method in the meantime.
