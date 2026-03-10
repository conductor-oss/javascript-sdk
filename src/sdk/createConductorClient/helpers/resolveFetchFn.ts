import {
  getUndiciHttp2FetchFn,
  type UndiciHttp2Options,
} from "./getUndiciHttp2FetchFn";

export const resolveFetchFn = async (
  customFetch?: typeof fetch,
  undiciOptions?: UndiciHttp2Options
): Promise<typeof fetch> => {
  if (customFetch) return customFetch;
  if (process?.release?.name !== "node") return fetch;

  try {
    return await getUndiciHttp2FetchFn(undiciOptions);
  } catch {
    return fetch;
  }
};
