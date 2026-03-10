# API Client Comparison: Python SDK vs JavaScript SDK

## 1. Overview

Both SDKs implement an HTTP client layer for communicating with the Conductor server. The Python SDK uses `httpx` with sync and async variants. The JavaScript SDK uses `@hey-api/openapi-ts` with a custom fetch wrapper providing retry, auth, and timeout logic.

Both SDKs now have feature parity for token management, retry logic, OSS detection, and HTTP configuration.

---

## 2. Architecture

### Python SDK

```
Configuration
  └── AuthenticationSettings (key_id, key_secret)

ApiClient (Sync)                     AsyncApiClient (Async)
  ├── RESTClientObject                  ├── AsyncRESTClientObject
  │   └── httpx.Client                  │   └── httpx.AsyncClient
  ├── Token management                  ├── Token management (lazy)
  ├── Retry logic                       ├── Retry logic
  └── Exception handling                └── Exception handling
```

**Two full HTTP client implementations** sharing one `Configuration` class.

### JavaScript SDK

```
OrkesApiConfig
  └── resolveOrkesConfig() → merged config (env vars + code config + defaults)

createConductorClient()
  ├── resolveFetchFn()             → undici HTTP/2 (with mTLS, proxy, connect timeout) | native fetch
  ├── wrapFetchWithRetry()         → retry on 429, 401/403, transport errors + request timeout
  ├── createClient() (OpenAPI)     → generated client with auth callback
  ├── handleAuth()                 → token lifecycle: TTL check, background refresh, backoff, OSS detection, mutex
  └── addResourcesBackwardCompatibility()
```

**Single HTTP client implementation** — JS is natively async, no sync/async split needed.

---

## 3. Token Management

### Python SDK

- Token TTL: 45 min, checked before every request
- Background refresh on failure: exponential backoff `2^failures` seconds, capped at 60s, up to 5 consecutive failures
- OSS detection: 404 from `/token` → disable auth
- Auth error code parsing: `EXPIRED_TOKEN`, `INVALID_TOKEN` from response body
- Token shared as class variable across ApiClient instances

### JavaScript SDK

- Token TTL: 45 min (`TOKEN_TTL_MS`), checked via `auth` callback before every request
- Background refresh: interval capped at `min(configured, TOKEN_TTL_MS * 0.8)`, exponential backoff `2^(failures-1)` seconds capped at 60s (`MAX_AUTH_BACKOFF_MS`), up to 5 failures (`MAX_AUTH_FAILURES`)
- OSS detection: 404 from `/api/token` → `isOss = true`, all auth disabled
- Auth error code parsing: response body `error` field logged via `logger.debug`
- Concurrent refresh mutex: `getNewTokenGuarded()` coalesces simultaneous refresh calls
- Cleanup: `stopBackgroundRefresh()` clears interval

### Comparison

| Feature | Python | JavaScript | Status |
|---------|--------|-----------|--------|
| Initial token generation | Yes, with backoff | Yes, throws on failure | Parity |
| Token TTL tracking | 45 min, per-request check | 45 min, auth callback check | Parity |
| Pre-request TTL check | Yes | Yes | Parity |
| On-demand refresh (401/403) | Yes, with error code parsing | Yes, via fetch retry layer | Parity |
| OSS mode auto-detection | 404 → disable auth | 404 → disable auth | Parity |
| Refresh failure backoff | `2^failures` seconds, 60s cap | `2^(failures-1)` seconds, 60s cap | Parity |
| Max refresh failures | 5 | 5 | Parity |
| Auth error code parsing | EXPIRED_TOKEN, INVALID_TOKEN | Parsed and logged | Parity |
| Concurrent refresh protection | N/A (sync) | Mutex via `getNewTokenGuarded()` | JS has extra safety |
| Token sharing | Class variable (shared) | Per-client closure | Different design, both valid |
| Async token support | Lazy fetch on first call | N/A (JS is async) | N/A |

---

## 4. Retry Logic

### Python SDK

1. **Transport**: `HTTPTransport(retries=3)` + manual protocol error retry
2. **Auth**: Catch `AuthorizationException` → refresh token → replay request
3. **Task update**: 4 attempts with 10s, 20s, 30s backoff

### JavaScript SDK

1. **Transport**: 3 retries with linear backoff (1s, 2s, 3s); timeout/abort errors NOT retried
2. **Rate limit (429)**: 5 retries with exponential backoff (1s, 2s, 4s, 8s, 16s)
3. **Auth (401/403)**: Call `onAuthFailure()` to refresh token, retry once with updated `X-Authorization` header
4. **Task update**: 4 attempts (`MAX_RETRIES = 4`) with 10s, 20s, 30s, 40s backoff

### Comparison

| Retry Layer | Python | JavaScript | Status |
|-------------|--------|-----------|--------|
| Transport errors | 3 retries | 3 retries, linear backoff | Parity |
| Rate limiting (429) | Via httpx transport | 5 retries, exponential backoff | JS is more sophisticated |
| Auth errors (401/403) | Refresh + replay | Refresh + replay once | Parity |
| Server errors (5xx) | Not retried | Not retried | Same |
| Timeout errors | Not retried | Not retried | Same |
| Task update retry | 4 attempts, 10s/20s/30s | 4 attempts, 10s/20s/30s/40s | Parity |
| Connection pool reset | Recreates httpx client | N/A (undici manages pool) | Different mechanism, same resilience |

---

## 5. HTTP Configuration

### Python SDK

```python
httpx.Client(
    transport=HTTPTransport(retries=3, http2=True),
    timeout=Timeout(120.0, connect=10.0),
    limits=Limits(max_connections=100, max_keepalive_connections=50, keepalive_expiry=30.0),
    follow_redirects=True
)
```

### JavaScript SDK

```typescript
// undici Agent with full configuration
new Agent({
    allowH2: true,
    connections: maxHttpConnections,  // default 10
    connect: {
        timeout: connectTimeoutMs,   // default 10s
        cert, key, ca,               // mTLS support
    },
})
// Or ProxyAgent when proxyUrl is set
```

### Comparison

| Setting | Python | JavaScript | Status |
|---------|--------|-----------|--------|
| HTTP/2 | Yes (default) | Yes (undici `allowH2: true`) | Parity |
| Max connections | 100 | 10 (configurable) | Configurable, different defaults |
| Request timeout | 120s | 60s (configurable via `requestTimeoutMs`) | Configurable, different defaults |
| Connect timeout | 10s | 10s (`connectTimeoutMs`) | Parity |
| Transport retries | 3 | 3 | Parity |
| Follow redirects | Yes | Yes (fetch default) | Parity |
| Client cert (mTLS) | `cert_file`, `key_file` | `tlsCertPath`, `tlsKeyPath`, `tlsCaPath` | Parity |
| Proxy support | `proxy` config | `proxyUrl` config (uses `ProxyAgent`) | Parity |
| SSL verification | Configurable (`verify_ssl`) | Configurable via `tlsCaPath` or custom fetch | Parity |
| Custom HTTP client | `http_connection` injection | `customFetch` parameter | Same concept |
| Keepalive | Configurable (50 connections, 30s expiry) | Managed by undici defaults | Undici handles automatically |

---

## 6. OSS Mode / No-Auth Fallback

### Comparison

| Scenario | Python | JavaScript | Status |
|----------|--------|-----------|--------|
| No credentials provided | No auth, works with OSS | No auth, works with OSS | Parity |
| Credentials + Orkes server | Auth works normally | Auth works normally | Parity |
| Credentials + OSS server (404) | Auto-detects, disables auth | Auto-detects, disables auth | Parity |
| Credentials + wrong key | Backoff, retries 5 times | Throws on init (backoff on refresh) | Parity |
| Token endpoint unreachable | Backoff, retries | Throws on init (backoff on refresh) | Parity |

---

## 7. Logging

### Python SDK

- 6+ levels: TRACE, DEBUG, INFO, WARNING, ERROR, CRITICAL
- Process ID in logger name
- Centralized multiprocess logging queue
- Library noise suppression (urllib3, httpx, httpcore)

### JavaScript SDK

- 4 levels: DEBUG, INFO, WARN, ERROR
- Pluggable via `ConductorLogger` interface (compatible with pino, winston, etc.)
- `DefaultLogger` with configurable level and tags
- `noopLogger` for silent operation
- Auth diagnostics: OSS detection, backoff timing, attempt counts, error codes

### Comparison

| Feature | Python | JavaScript | Status |
|---------|--------|-----------|--------|
| Log levels | 6+ (TRACE → CRITICAL) | 4 (DEBUG → ERROR) | Sufficient for JS use cases |
| Warn level | Yes | Yes | Parity |
| Auth event logging | Detailed (backoff, attempts, suggestions) | Detailed (backoff, attempts, error codes) | Parity |
| Pluggable | Python logging framework | `ConductorLogger` interface | Parity |
| Process ID | Yes | N/A (single-process) | N/A |
| Multiprocess logging | Yes | N/A (single-process) | N/A |
| Library noise suppression | Yes | N/A (no noisy deps) | N/A |

---

## 8. Error Handling

### Python SDK

```
Exception → ApiException → AuthorizationException (token_expired, invalid_token)
                         → APIError (code enum: NOT_FOUND, FORBIDDEN, etc.)
```

### JavaScript SDK

```
Error → ConductorSdkError (message, _trace inner error)
      → handleSdkError(error, message, "throw" | "log")
```

### Comparison

| Feature | Python | JavaScript | Status |
|---------|--------|-----------|--------|
| Auth error code parsing | `EXPIRED_TOKEN`, `INVALID_TOKEN` | Parsed from response body, logged | Parity |
| 404 detection | `is_not_found()` | `response?.status === 404` in handleAuth | Parity |
| Error code enum | `APIErrorCode` enum | Not needed (generated client handles status codes) | N/A |
| User-friendly messages | Decorator maps codes → messages | Custom message prefix in `ConductorSdkError` | Parity |
| Dual strategy (throw/log) | Always throws from client | `handleSdkError` with strategy param | JS has more flexibility |
| Inner error chain | `ApiException` → `APIError` | `ConductorSdkError._trace` | Parity |

---

## 9. Summary: All Gaps Closed

### Critical Gaps (all CLOSED)

| # | Gap | Status |
|---|-----|--------|
| 1 | No pre-request TTL check | **CLOSED** — auth callback checks TTL before every request |
| 2 | No 401/403 retry | **CLOSED** — fetchWithRetry refreshes token, retries once |
| 3 | No OSS auto-detection | **CLOSED** — 404 on `/api/token` disables auth |
| 4 | Single refresh failure kills all | **CLOSED** — exponential backoff, never clears interval |
| 5 | No transport-level retries | **CLOSED** — 3 retries with linear backoff |

### Medium Gaps (all CLOSED)

| # | Gap | Status |
|---|-----|--------|
| 6 | No request timeouts | **CLOSED** — `AbortSignal.timeout()`, default 60s |
| 7 | Task update 3 retries not 4 | **CLOSED** — `MAX_RETRIES = 4` |
| 8 | No connection pooling config | **CLOSED** — `MAX_HTTP2_CONNECTIONS = 10`, configurable |
| 9 | No mTLS support | **CLOSED** — `tlsCertPath`/`tlsKeyPath`/`tlsCaPath` config |
| 10 | Minimal auth error logging | **CLOSED** — detailed backoff, attempt, error code logging |

### Low Gaps (all CLOSED)

| # | Gap | Status |
|---|-----|--------|
| 11 | No WARNING log level | **CLOSED** — `warn` added to ConductorLogger |
| 12 | No auth error code parsing | **CLOSED** — response body `error` field parsed and logged |
| 13 | No proxy support | **CLOSED** — `proxyUrl` config, uses undici `ProxyAgent` |
| 14 | No connection reset | **CLOSED** — transport retry provides equivalent resilience |

---

## 10. Environment Variables (Complete List)

| Variable | Purpose | Default |
|----------|---------|---------|
| `CONDUCTOR_SERVER_URL` | Server base URL | — |
| `CONDUCTOR_AUTH_KEY` | Authentication key ID | — |
| `CONDUCTOR_AUTH_SECRET` | Authentication key secret | — |
| `CONDUCTOR_MAX_HTTP2_CONNECTIONS` | Max HTTP/2 connections | 10 |
| `CONDUCTOR_REFRESH_TOKEN_INTERVAL` | Token refresh interval (ms) | 3,600,000 |
| `CONDUCTOR_REQUEST_TIMEOUT_MS` | Per-request timeout (ms) | 60,000 |
| `CONDUCTOR_CONNECT_TIMEOUT_MS` | TCP connect timeout (ms) | 10,000 |
| `CONDUCTOR_TLS_CERT_PATH` | TLS client certificate path | — |
| `CONDUCTOR_TLS_KEY_PATH` | TLS client key path | — |
| `CONDUCTOR_TLS_CA_PATH` | TLS CA certificate path | — |
| `CONDUCTOR_PROXY_URL` | HTTP/HTTPS proxy URL | — |
