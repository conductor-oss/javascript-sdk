const HTTPBIN_HOST =
  process.env.HTTPBIN_SERVICE_HOSTNAME ?? "httpbin-server";

export const HTTPBIN_BASE_URL = `http://${HTTPBIN_HOST}:8081`;
