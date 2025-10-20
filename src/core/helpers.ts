import { ConductorSdkError } from "./types";

export const errorMapper = (error: unknown): ConductorSdkError => {
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

  return new ConductorSdkError(message, innerError);
};

export const handleSdkError = (
  error?: unknown,
  customMessage?: string,
  strategy: "throw" | "log" = "throw"
) => {
  const innerError = error instanceof Error ? error : undefined;

  const messageFromError =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : undefined;

  const fullMessage =
    customMessage && messageFromError
      ? `${customMessage}: ${messageFromError}`
      : customMessage || messageFromError || "Unknown error";

  if (strategy === "throw") {
    throw new ConductorSdkError(fullMessage, innerError);
  } else {
    console.error(`[Conductor SDK Error]: ${fullMessage}\n`, innerError);
  }
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
