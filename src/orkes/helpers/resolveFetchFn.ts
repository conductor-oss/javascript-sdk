import { FetchFn } from "../types";
import { createUndiciHttp2Fetch } from "./createUndiciHttp2Fetch";

export const resolveFetchFn = (customFetch?: FetchFn) =>
  customFetch ||
  (process?.release?.name === "node"
    ? (createUndiciHttp2Fetch() as FetchFn)
    : fetch);
