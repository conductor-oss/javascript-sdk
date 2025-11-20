import { MAX_HTTP2_CONNECTIONS } from "../constants";
// eslint-disable-next-line
// @ts-ignore since undici is an optional dependency and could be missing
import type {
  RequestInfo as UndiciRequestInfo,
  RequestInit as UndiciRequestInit,
  BodyInit as UndiciBodyInit,
  HeadersInit as UndiciHeadersInit,
} from "undici";

export const getUndiciHttp2FetchFn = async (
  maxHttpConnections = MAX_HTTP2_CONNECTIONS
) => {
  // eslint-disable-next-line
  // @ts-ignore since undici is an optional dependency and could be missing
  const { fetch: undiciFetch, Agent } = await import("undici");
  const undiciAgent = new Agent({
    allowH2: true,
    connections: maxHttpConnections,
  });

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
        dispatcher: undiciAgent,
      });
    }

    return undiciFetch(input, { ...init, dispatcher: undiciAgent });
  }) as typeof fetch;
};
