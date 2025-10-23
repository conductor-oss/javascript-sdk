# OrkesConductorClient API Reference

The `OrkesConductorClient` is the main entry point for creating authenticated Conductor clients. It handles authentication, configuration, and provides the foundation for all other API clients.

## Main Function

### `orkesConductorClient(config?: OrkesApiConfig, customFetch?: typeof fetch): Promise<Client>`

Creates and returns an authenticated Conductor client instance.

**Parameters:**

-   `config` (`OrkesApiConfig`, optional): Configuration options for the client.
-   `customFetch` (`typeof fetch`, optional): Custom fetch function to use for HTTP requests.

**Returns:**

-   `Promise<Client>`: A promise that resolves to the authenticated Conductor client.

**Example:**

```typescript
import { orkesConductorClient } from "@io-orkes/conductor-javascript";

// Using configuration object
const client = await orkesConductorClient({
  serverUrl: "https://play.orkes.io/api",
  keyId: "your-key-id",
  keySecret: "your-key-secret",
  refreshTokenInterval: 1800000, // 30 minutes
  maxHttp2Connections: 2
});

// Using environment variables
const client2 = await orkesConductorClient();

// Using custom fetch function
const client3 = await orkesConductorClient(config, customFetch);
```

## Configuration Options

### `OrkesApiConfig`

Configuration interface for the Orkes Conductor client.

| Property | Type | Description |
| --- | --- | --- |
| `serverUrl` | `string` | The URL of the Conductor server API. Can also be set via `CONDUCTOR_SERVER_URL` environment variable. |
| `keyId` | `string` | The API key ID for authentication. Can also be set via `CONDUCTOR_AUTH_KEY` environment variable. |
| `keySecret` | `string` | The API key secret for authentication. Can also be set via `CONDUCTOR_AUTH_SECRET` environment variable. |
| `refreshTokenInterval` | `number` | Token refresh interval in milliseconds. Set to 0 to disable auto-refresh. Can also be set via `CONDUCTOR_REFRESH_TOKEN_INTERVAL` environment variable. Default is 30 minutes (1800000ms). |
| `useEnvVars` | `boolean` | DEPRECATED: This property has no effect. Environment variables are always prioritized. |
| `maxHttp2Connections` | `number` | Maximum number of simultaneous HTTP/2 connections. Can also be set via `CONDUCTOR_MAX_HTTP2_CONNECTIONS` environment variable. Default is 1. |

## Environment Variables

The client prioritizes environment variables over configuration options:

```bash
CONDUCTOR_SERVER_URL=https://play.orkes.io/api
CONDUCTOR_AUTH_KEY=your-key-id
CONDUCTOR_AUTH_SECRET=your-key-secret
CONDUCTOR_REFRESH_TOKEN_INTERVAL=1800000
CONDUCTOR_MAX_HTTP2_CONNECTIONS=2
```

## Authentication

The client automatically handles authentication using the provided API keys. It will:

1. Authenticate with the Conductor server using the provided credentials
2. Automatically refresh tokens based on the `refreshTokenInterval` setting
3. Include authentication headers in all API requests

**Note:** If `keyId` and `keySecret` are not provided, the client will work without authentication but may have limited access to Conductor features.

## Error Handling

The client throws errors for common configuration issues:

- `"Conductor server URL is not set"` - When no server URL is provided via config or environment variables

## Custom Fetch Function

You can provide a custom fetch function for advanced use cases:

```typescript
const client = await orkesConductorClient(config, async (url, options) => {
  // Custom request logic
  console.log(`Making request to ${url}`);
  return fetch(url, options);
});
```

## Client Interface

The returned client implements the OpenAPI-generated `Client` interface and provides access to all Conductor APIs through the various resource classes (MetadataResource, WorkflowResource, TaskResource, etc.).
