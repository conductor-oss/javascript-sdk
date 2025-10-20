import { ConductorSdkError } from "./types";

export function handleSdkError(
  error?: unknown,
  customMessage?: string,
  strategy?: "throw"
): never;
export function handleSdkError(
  error?: unknown,
  customMessage?: string,
  strategy?: "log"
): void;
export function handleSdkError(
  error?: unknown,
  customMessage?: string,
  strategy: "throw" | "log" = "throw"
): void | never {
  const innerError = error instanceof Error ? error : undefined;

  const messageFromError =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : undefined;

  const fullMessage =
    customMessage && messageFromError
      ? `${customMessage}: ${messageFromError}`
      : customMessage || messageFromError || "Unknown error";

  if (strategy === "log") {
    console.error(`[Conductor SDK Error]: ${fullMessage}\n`, innerError);
  } else {
    throw new ConductorSdkError(fullMessage, innerError);
  }
}

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
