export const DEFAULT_POLL_INTERVAL = 100;
export const DEFAULT_CONCURRENCY = 1;
export const DEFAULT_WARN_AT_O = 100;
export const DEFAULT_BATCH_POLLING_TIMEOUT = 100;
export const DEFAULT_ERROR_MESSAGE = "An unknown error occurred";
export const MAX_RETRIES = 4;

// Adaptive backoff for empty polls (matching Python SDK)
// Backoff sequence: 1ms, 2ms, 4ms, 8ms, 16ms, 32ms, 64ms, 128ms, 256ms, 512ms, 1024ms
// Then capped at pollInterval
export const ADAPTIVE_BACKOFF_BASE_MS = 1;
export const ADAPTIVE_BACKOFF_MAX_EXPONENT = 10; // 2^10 = 1024ms cap

// Auth failure backoff (matching Python SDK: 2^N seconds, capped at 60s)
export const AUTH_BACKOFF_MAX_SECONDS = 60;

// Health monitoring
export const HEALTH_CHECK_INTERVAL_MS = 5000;
export const RESTART_BACKOFF_BASE_MS = 1000;
export const RESTART_BACKOFF_MAX_MS = 60000;
