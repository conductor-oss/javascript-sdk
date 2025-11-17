type Input = Parameters<typeof fetch>[0];
type Init = Parameters<typeof fetch>[1];

export const retryFetch = async (
  input: Input,
  init: Init,
  fetchFn: typeof fetch,
  retries = 5,
  delay = 1000
): Promise<Response> => {
  const response = await fetchFn(input, init);
  if (response.status == 429 && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryFetch(input, init, fetchFn, retries - 1, delay * 2);
  }
  return response;
};

export const wrapFetchWithRetry = (fetchFn: typeof fetch): typeof fetch => {
  return (input: Input, init?: Init): Promise<Response> => {
    return retryFetch(input, init, fetchFn);
  };
};
