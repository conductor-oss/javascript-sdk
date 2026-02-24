export const REFRESH_TOKEN_IN_MILLISECONDS = 3600000; // 1 hour
export const MAX_HTTP2_CONNECTIONS = 10;

// Token management
export const TOKEN_TTL_MS = 2_700_000; // 45 minutes - refresh token before it expires
export const MAX_AUTH_FAILURES = 5; // stop logging errors after this many consecutive failures
export const MAX_AUTH_BACKOFF_MS = 60_000; // 60s cap on exponential backoff

// Fetch retry
export const MAX_TRANSPORT_RETRIES = 3;
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000; // 60 seconds
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000; // 10 seconds (matches Python SDK)
