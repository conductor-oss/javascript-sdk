import { ConductorError } from "./types";

export const errorMapper = (error: unknown): ConductorError => {
  //todo: add error.message, mb error.status
  const message =
    error &&
    typeof error === "object" &&
    "body" in error &&
    error.body &&
    typeof error.body === "object" &&
    "message" in error.body &&
    typeof error.body.message === "string"
      ? error.body.message
      : undefined;

  const innerError = error instanceof Error ? error : undefined;

  return new ConductorError(message, innerError);
};

export function reverseFind<T>(
  array: T[],
  predicate: (a: T, idx?: number, arr?: T[]) => boolean
): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return array[i];
    }
  }
  return undefined;
}
