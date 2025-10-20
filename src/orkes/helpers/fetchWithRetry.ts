import { FetchFn } from "../types";

export const retryFetch = async (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fetchFn: FetchFn,
  retries: number = 5,
  delay: number = 1000
): Promise<Response> => {
  const response = await fetchFn(input, init);
  if (response.status == 429 && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryFetch(input, init, fetchFn, retries - 1, delay * 2);
  }
  return response;
};

export const wrapFetchWithRetry = (fetchFn: FetchFn): FetchFn => {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return retryFetch(input, init, fetchFn);
  };
};
