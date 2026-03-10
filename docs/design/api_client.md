# API Client Design

## Overview

The API client layer (`createConductorClient`) provides authenticated, resilient HTTP communication with the Conductor server. It handles token lifecycle, retry logic, timeouts, HTTP/2 connection pooling, mTLS, and proxy support.

```
createConductorClient(config?, customFetch?)
  │
  ├── resolveOrkesConfig(config)          Merge env vars + config + defaults
  │
  ├── resolveFetchFn(customFetch, opts)   Choose: customFetch → undici HTTP/2 → native fetch
  │     └── getUndiciHttp2FetchFn(opts)   Agent/ProxyAgent with H2, mTLS, connect timeout
  │
  ├── wrapFetchWithRetry(fetch, opts)     Wrap: timeout → transport retry → 429 retry → 401 retry
  │
  ├── handleAuth(client, key, secret)     Token lifecycle: init → callback → refresh → backoff
  │     ├── getNewToken()                 POST /api/token (OSS 404 detection, error code parsing)
  │     ├── getNewTokenGuarded()          Mutex: coalesce concurrent refresh calls
  │     ├── auth callback                 Pre-request TTL check, inline refresh
  │     ├── background refresh            setInterval with exponential backoff
  │     └── stopBackgroundRefresh()       Cleanup
  │
  └── addResourcesBackwardCompatibility() Attach legacy v2 API methods
```

---

## Config Resolution

`resolveOrkesConfig` merges three sources in priority order: **environment variable → code config → default**.

Numeric env vars use `parseEnvNumber()` which handles `"0"` correctly (unlike `Number(x) || default`).

| Config Field | Env Var | Default |
|---|---|---|
| `serverUrl` | `CONDUCTOR_SERVER_URL` | — |
| `keyId` | `CONDUCTOR_AUTH_KEY` | — |
| `keySecret` | `CONDUCTOR_AUTH_SECRET` | — |
| `maxHttp2Connections` | `CONDUCTOR_MAX_HTTP2_CONNECTIONS` | — |
| `refreshTokenInterval` | `CONDUCTOR_REFRESH_TOKEN_INTERVAL` | 3,600,000 (1hr) |
| `requestTimeoutMs` | `CONDUCTOR_REQUEST_TIMEOUT_MS` | 60,000 (60s) |
| `connectTimeoutMs` | `CONDUCTOR_CONNECT_TIMEOUT_MS` | 10,000 (10s) |
| `tlsCertPath` | `CONDUCTOR_TLS_CERT_PATH` | — |
| `tlsKeyPath` | `CONDUCTOR_TLS_KEY_PATH` | — |
| `tlsCaPath` | `CONDUCTOR_TLS_CA_PATH` | — |
| `proxyUrl` | `CONDUCTOR_PROXY_URL` | — |
| `logger` | — | — |

---

## HTTP Transport

### Fetch Resolution

1. If `customFetch` is provided → use it directly (no undici)
2. If running on Node.js → try `getUndiciHttp2FetchFn()` (undici is an optional dep)
3. Fallback → native `globalThis.fetch`

### Undici Agent

```typescript
new Agent({
  allowH2: true,
  connections: maxHttpConnections,     // default 10
  connect: {
    timeout: connectTimeoutMs,         // default 10s
    cert, key, ca,                     // mTLS (read from file paths)
  },
})
```

When `proxyUrl` is set, `ProxyAgent` is used instead of `Agent` with the same options.

---

## Token Lifecycle

### State

All token state lives in a closure inside `handleAuth`:

```
token: string | undefined          Current JWT
tokenObtainedAt: number            Timestamp of last successful refresh
isOss: boolean                     True if /api/token returned 404
consecutiveFailures: number        Count of consecutive refresh failures
lastRefreshFailureAt: number       Timestamp of last failure (for backoff)
refreshInFlight: Promise | null    Mutex for concurrent refresh coalescing
```

### Flow

```
1. INITIAL AUTH
   getNewToken()
     ├── 200 + token → store token, set auth callback, start background refresh
     ├── 404         → isOss=true, return undefined (no auth)
     └── error       → throw ConductorSdkError (parse error code if present)

2. PER-REQUEST (auth callback)
   Called by OpenAPI client before each request via setConfig({ auth: callback })
     ├── isOss?      → return undefined
     ├── TTL OK?     → return current token
     └── TTL expired → getNewTokenGuarded() → return fresh token
                        (if refresh fails: log warn, return stale token)

3. BACKGROUND REFRESH (setInterval)
   Interval = min(configuredInterval, TOKEN_TTL_MS * 0.8) ≈ 36 minutes
     ├── shouldBackoff()? → skip this tick
     ├── getNewTokenGuarded() success → reset failures
     └── failure → increment failures, log warn/error with backoff timing
         (NEVER clears interval)

4. ON 401/403 (fetch retry layer)
   fetchWithRetry detects 401/403 → calls onAuthFailure()
     └── refreshToken() → getNewTokenGuarded() → return new token or stale token
         fetch retries once with updated X-Authorization header
```

### Backoff

```
Delay = min(2^(consecutiveFailures - 1) * 1000ms, MAX_AUTH_BACKOFF_MS)

Failures:  1      2      3      4      5+
Backoff:   1s     2s     4s     8s     16s → 32s → 60s (cap)
```

### Concurrent Refresh Mutex

`getNewTokenGuarded()` prevents duplicate API calls when background refresh and inline refresh trigger simultaneously:

```typescript
if (refreshInFlight) return refreshInFlight;  // coalesce onto existing
refreshInFlight = getNewToken().finally(() => { refreshInFlight = null; });
return refreshInFlight;
```

### OSS Detection

When `/api/token` returns 404:
- `isOss = true`
- Auth callback returns `undefined` (no auth header sent)
- Background refresh skips all ticks
- Logged as info: "Conductor OSS detected"

### Auth Error Code Parsing

When token generation fails with 401/403, the response body's `error` field is parsed for codes like `EXPIRED_TOKEN` or `INVALID_TOKEN` and logged via `logger.debug` for diagnostics. This doesn't change retry behavior (all 401/403 are retried) but aids debugging.

---

## Retry Layers

The fetch wrapper (`wrapFetchWithRetry`) applies retries in this order:

```
Request
  │
  ├── Apply timeout (AbortSignal.timeout)
  │
  ├── TRANSPORT RETRY LOOP (up to maxTransportRetries=3)
  │     fetch() throws?
  │       ├── AbortError/TimeoutError → throw (no retry)
  │       └── Other error → wait (linear backoff), retry
  │
  ├── 429? → RATE LIMIT RETRY (up to maxRateLimitRetries=5)
  │           wait (exponential backoff), retry
  │
  ├── 401/403 + onAuthFailure? → AUTH RETRY (once)
  │     onAuthFailure() → get new token
  │     Clone request with new X-Authorization header
  │     Retry once
  │
  └── Return response
```

### Timeout

```typescript
AbortSignal.timeout(requestTimeoutMs)  // default 60s
```

If the request already has an AbortSignal, they're combined:
- Node 20+: `AbortSignal.any([existing, timeout])`
- Node 18: Manual `AbortController` wrapper with event listeners

Timeout/abort errors are NOT retried by the transport retry loop.

---

## Constants

| Constant | Value | File |
|----------|-------|------|
| `TOKEN_TTL_MS` | 2,700,000 (45 min) | `createConductorClient/constants.ts` |
| `MAX_AUTH_FAILURES` | 5 | `createConductorClient/constants.ts` |
| `MAX_AUTH_BACKOFF_MS` | 60,000 (60s) | `createConductorClient/constants.ts` |
| `MAX_HTTP2_CONNECTIONS` | 10 | `createConductorClient/constants.ts` |
| `MAX_TRANSPORT_RETRIES` | 3 | `createConductorClient/constants.ts` |
| `DEFAULT_REQUEST_TIMEOUT_MS` | 60,000 (60s) | `createConductorClient/constants.ts` |
| `DEFAULT_CONNECT_TIMEOUT_MS` | 10,000 (10s) | `createConductorClient/constants.ts` |
| `REFRESH_TOKEN_IN_MILLISECONDS` | 3,600,000 (1hr) | `createConductorClient/constants.ts` |
| `MAX_RETRIES` | 4 | `clients/worker/constants.ts` |

---

## File Map

| File | Responsibility |
|------|---------------|
| `createConductorClient.ts` | Orchestrator: resolves config, creates client, wires auth + retry |
| `helpers/resolveOrkesConfig.ts` | Merges env vars + config + defaults |
| `helpers/resolveFetchFn.ts` | Chooses fetch implementation |
| `helpers/getUndiciHttp2FetchFn.ts` | Creates undici Agent/ProxyAgent with H2, mTLS, connect timeout |
| `helpers/fetchWithRetry.ts` | Retry wrapper: transport, 429, 401/403, timeouts |
| `helpers/handleAuth.ts` | Token lifecycle: init, callback, background refresh, backoff, mutex |
| `helpers/addResourcesBackwardCompatibility.ts` | Legacy v2 API method wrappers |
| `constants.ts` | All timing/retry/pool constants |
| `types.ts` (`OrkesApiConfig`) | Configuration interface |
| `helpers/logger.ts` | `ConductorLogger` interface, `DefaultLogger`, `noopLogger` |
| `helpers/errors.ts` | `ConductorSdkError`, `handleSdkError` |

---

## Testing

### Unit Tests

| Test File | Count | Covers |
|-----------|-------|--------|
| `handleAuth.test.ts` | 25 | Token TTL, OSS detection, backoff, background refresh, mutex, error code parsing, stopBackgroundRefresh |
| `fetchWithRetry.test.ts` | 29 | Transport/429/401 retry, timeouts, signal combining, interactions |
| `resolveOrkesConfig.test.ts` | 25 | Env var parsing (including `0`), defaults, TLS/proxy/connect timeout config |

### Integration Tests

| Test File | Count | Covers |
|-----------|-------|--------|
| `createConductorClient.test.ts` | 11 | Full wiring: auth flow, OSS detection, 401/transport/429 retry, config resolution |

### Running Tests

```bash
# Unit + integration tests for API client layer
npx jest --testPathPattern='(handleAuth|fetchWithRetry|createConductorClient|resolveOrkesConfig)\.test'

# All unit tests
npm run test:unit

# Integration tests (requires running Conductor server)
npm run test:integration:orkes-v5
```
