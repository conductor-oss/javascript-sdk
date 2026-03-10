import { MAX_HTTP2_CONNECTIONS, DEFAULT_CONNECT_TIMEOUT_MS } from "../constants";
// eslint-disable-next-line
// @ts-ignore since undici is an optional dependency and could be missing
import type {
  RequestInfo as UndiciRequestInfo,
  RequestInit as UndiciRequestInit,
  BodyInit as UndiciBodyInit,
  HeadersInit as UndiciHeadersInit,
} from "undici";

export interface UndiciHttp2Options {
  maxHttpConnections?: number;
  connectTimeoutMs?: number;
  tlsCertPath?: string;
  tlsKeyPath?: string;
  tlsCaPath?: string;
  proxyUrl?: string;
  tlsInsecure?: boolean;
  disableHttp2?: boolean;
}

export const getUndiciHttp2FetchFn = async (
  options: UndiciHttp2Options = {}
) => {
  const {
    maxHttpConnections = MAX_HTTP2_CONNECTIONS,
    connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
    tlsCertPath,
    tlsKeyPath,
    tlsCaPath,
    proxyUrl,
    tlsInsecure,
    disableHttp2,
  } = options;

  // eslint-disable-next-line
  // @ts-ignore since undici is an optional dependency and could be missing
  const undici = await import("undici");
  const { fetch: undiciFetch } = undici;

  // Build connect options (TLS + connect timeout)
  const connectOptions: Record<string, unknown> = {};
  if (connectTimeoutMs) {
    connectOptions.timeout = connectTimeoutMs;
  }

  // mTLS: read cert/key/ca files if provided
  if (tlsCertPath || tlsKeyPath || tlsCaPath) {
    const { readFileSync } = await import("node:fs");
    if (tlsCertPath) connectOptions.cert = readFileSync(tlsCertPath);
    if (tlsKeyPath) connectOptions.key = readFileSync(tlsKeyPath);
    if (tlsCaPath) connectOptions.ca = readFileSync(tlsCaPath);
  }

  // Disable TLS certificate verification (for self-signed certs in dev/staging)
  if (tlsInsecure) {
    connectOptions.rejectUnauthorized = false;
  }

  // Create the appropriate dispatcher (Agent or ProxyAgent)
  let dispatcher: InstanceType<typeof undici.Agent>;
  const agentOptions = {
    allowH2: !disableHttp2,
    connections: maxHttpConnections,
    connect: Object.keys(connectOptions).length > 0 ? connectOptions : undefined,
  };

  if (proxyUrl) {
    dispatcher = new undici.ProxyAgent({
      uri: proxyUrl,
      ...agentOptions,
    });
  } else {
    dispatcher = new undici.Agent(agentOptions);
  }

  return ((input: UndiciRequestInfo | Request, init?: UndiciRequestInit) => {
    if (input instanceof Request) {
      const { url, method, headers, body, signal } = input;

      return undiciFetch(url, {
        method,
        headers: headers as UndiciHeadersInit,
        body: body as UndiciBodyInit,
        duplex: body ? "half" : undefined,
        signal,
        ...init,
        dispatcher,
      });
    }

    return undiciFetch(input, { ...init, dispatcher });
  }) as typeof fetch;
};
