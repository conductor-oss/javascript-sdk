type Input = Parameters<typeof fetch>[0];
type Init = Parameters<typeof fetch>[1];

export const retryFetch = async (
  input: Input,
  init: Init,
  fetchFn: typeof fetch,
  retries = 5,
  delay = 1000
): Promise<Response> => {
  // Clone the Request object if input is a Request, so retries work correctly.
  // Request objects can only be used once - attempting to reuse them throws:
  // "Cannot construct a Request with a Request object that has already been used"
  const requestInput = input instanceof Request ? input.clone() : input;

  const response = await fetchFn(requestInput, init);
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
