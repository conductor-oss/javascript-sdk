import { FetchFn } from "../types";
// eslint-disable-next-line
// @ts-ignore since undici is an optional dependency and could be missing
import type {
  RequestInfo as UndiciRequestInfo,
  RequestInit as UndiciRequestInit,
} from "undici";

export const resolveFetchFn = async (
  customFetch?: FetchFn,
  maxHttpConnections: number = 1
): Promise<FetchFn> => {
  if (customFetch) return customFetch;
  if (process?.release?.name !== "node") return fetch;

  try {
    // eslint-disable-next-line
    // @ts-ignore since undici is an optional dependency and could be missing
    const { fetch: undiciFetch, Agent } = await import("undici");
    const undiciAgent = new Agent({ allowH2: true, connections: maxHttpConnections });

    return ((input: UndiciRequestInfo, init?: UndiciRequestInit) =>
      undiciFetch(input, { ...init, dispatcher: undiciAgent })) as FetchFn;
  } catch {
    return fetch;
  }
};
