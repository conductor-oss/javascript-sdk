export class ConductorSdkError extends Error {
  private _trace;
  private __proto__: unknown;

  constructor(message?: string, innerError?: Error) {
    super(message);
    this.name = "[Conductor SDK Error]";
    this._trace = innerError;
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
  }
}

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

