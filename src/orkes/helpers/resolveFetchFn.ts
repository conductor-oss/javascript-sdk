import { FetchFn } from "../types";
import { getUndiciHttp2FetchFn } from "./getUndiciHttp2FetchFn";

export const resolveFetchFn = async (
  customFetch?: FetchFn,
  maxHttpConnections?: number
): Promise<FetchFn> => {
  if (customFetch) return customFetch;
  if (process?.release?.name !== "node") return fetch;

  try {
    return await getUndiciHttp2FetchFn(maxHttpConnections);
  } catch {
    return fetch;
  }
};
