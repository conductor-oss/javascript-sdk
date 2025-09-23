import { FetchFn } from "../types";
// eslint-disable-next-line
// @ts-ignore since undici is an optional dependency and could me missing
import type { RequestInfo, RequestInit } from "undici";

export const resolveFetchFn = async (
  customFetch?: FetchFn
): Promise<FetchFn> => {
  if (customFetch) return customFetch;
  if (process?.release?.name !== "node") return fetch;

  try {
    // eslint-disable-next-line
    // @ts-ignore since undici is an optional dependency and could me missing
    const { fetch: undiciFetch, Agent } = await import("undici");
    const undiciAgent = new Agent({
      allowH2: true,
      connections: 1,
      //keepAliveTimeout: 4000,
      //keepAliveMaxTimeout: 1000 * 60 * 10,
    });

    return ((input: RequestInfo, init?: RequestInit) =>
      undiciFetch(input, { ...init, dispatcher: undiciAgent })) as FetchFn;
  } catch {
    return fetch;
  }
};
