The client is generated using [this library](https://github.com/hey-api/openapi-ts). Generated code must not be modified directly.

## Updating generated code

1. Copy OpenApi spec data from up to date cluster `({cluster_url}/api-docs)`
2. Paste to `open-api-spec/spec.json`
3. Prettify `spec.json`, run command: (todo: should be removed after OpenApi spec fix)

```text
node open-api-spec/fix-additional-properties.ts
```

4. run command:

```text
npm run generate-openapi-layer
```
