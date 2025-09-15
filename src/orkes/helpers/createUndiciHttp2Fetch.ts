import {
  fetch as undiciFetch,
  Agent as UndiciAgent,
  RequestInfo as UndiciRequestInfo,
  RequestInit as UndiciRequestInit,
} from "undici";

export const createUndiciHttp2Fetch = () => {
  const undiciHttp2Agent = new UndiciAgent({ allowH2: true });

  return async (input: UndiciRequestInfo, init?: UndiciRequestInit) => {
    return undiciFetch(input, {
      ...init,
      dispatcher: undiciHttp2Agent,
    });
  };
};
