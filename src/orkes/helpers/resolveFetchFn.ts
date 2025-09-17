import { FetchFn } from "../types";
import type { ResponseInit, RequestInfo } from "undici";

export const resolveFetchFn = async (
  customFetch?: FetchFn
): Promise<FetchFn> => {
  if (customFetch) return customFetch;
  if (process?.release?.name !== "node") return fetch;

  try {
    const undici = await import("undici");
    const agent = new undici.Agent({ allowH2: true });

    return ((input: RequestInfo, init: ResponseInit) =>
      undici.fetch(input, { ...init, dispatcher: agent })) as FetchFn;
  } catch {
    return fetch;
  }
};
