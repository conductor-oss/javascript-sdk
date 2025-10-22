/* eslint-disable */
// TODO: remove everything below (whole file) after April 2026 (backward compatibility types)
// ------------------------------start------------------------------
import {
  HumanTaskEntry,
  ScrollableSearchResultWorkflowSummary,
  Workflow,
  TaskListSearchResultSummary,
} from "./open-api";
import { Client } from "./open-api/client";

// DEPRECATED
export type TimeoutPolicy = {
  type: string;
};

// DEPRECATED
export type Terminate = TimeoutPolicy & {
  timeoutSeconds?: number;
};

// DEPRECATED
export type HTScrollableSearchResultHumanTaskEntry = {
  queryId?: string;
  results?: HumanTaskEntry[];
};

// DEPRECATED
export type StartWorkflow = {
  name?: string;
  version?: number;
  correlationId?: string;
  input?: Record<string, any>;
  taskToDomain?: Record<string, string>;
};

// DEPRECATED
export type SearchResultWorkflowSummary = ScrollableSearchResultWorkflowSummary;

// DEPRECATED
export type SearchResultWorkflow = {
  totalHits?: number;
  results?: Array<Workflow>;
};

// DEPRECATED
export type SearchResultTask = TaskListSearchResultSummary;

// DEPRECATED
export type ExternalStorageLocation = {
  uri?: string;
  path?: string;
};

// DEPRECATED
export interface OnCancel {
  readonly isResolved: boolean;
  readonly isRejected: boolean;
  readonly isCancelled: boolean;

  (cancelHandler: () => void): void;
}

// DEPRECATED
export type ApiRequestOptions = {
  readonly method:
    | "GET"
    | "PUT"
    | "POST"
    | "DELETE"
    | "OPTIONS"
    | "HEAD"
    | "PATCH";
  readonly url: string;
  readonly path?: Record<string, any>;
  readonly cookies?: Record<string, any>;
  readonly headers?: Record<string, any>;
  readonly query?: Record<string, any>;
  readonly formData?: Record<string, any>;
  readonly body?: any;
  readonly mediaType?: string;
  readonly responseHeader?: string;
  readonly errors?: Record<number, string>;
};

// DEPRECATED
type Resolver<T> = (options: ApiRequestOptions) => Promise<T>;
export type OpenAPIConfig = {
  BASE: string;
  VERSION: string;
  WITH_CREDENTIALS: boolean;
  CREDENTIALS: "include" | "omit" | "same-origin";
  TOKEN?: string | Resolver<string> | undefined;
  USERNAME?: string | Resolver<string> | undefined;
  PASSWORD?: string | Resolver<string> | undefined;
  HEADERS?: Headers | Resolver<Headers> | undefined;
  ENCODE_PATH?: ((path: string) => string) | undefined;
};

// DEPRECATED
export type ApiResult = {
  readonly url: string;
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly body: any;
};

// DEPRECATED
export class ApiError extends Error {
  public readonly url: string;
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: any;
  public readonly request: ApiRequestOptions;

  constructor(
    request: ApiRequestOptions,
    response: ApiResult,
    message: string
  ) {
    super(message);

    this.name = "ApiError";
    this.url = response.url;
    this.status = response.status;
    this.statusText = response.statusText;
    this.body = response.body;
    this.request = request;
  }
}

// DEPRECATED
export type ConductorClient = Client;

// DEPRECATED
export class CancelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CancelError";
  }

  public get isCancelled(): boolean {
    return true;
  }
}

// DEPRECATED
export class CancelablePromise<T> implements Promise<T> {
  #isResolved: boolean;
  #isRejected: boolean;
  #isCancelled: boolean;
  readonly #cancelHandlers: (() => void)[];
  readonly #promise: Promise<T>;
  #resolve?: (value: T | PromiseLike<T>) => void;
  #reject?: (reason?: any) => void;

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void,
      onCancel: OnCancel
    ) => void
  ) {
    this.#isResolved = false;
    this.#isRejected = false;
    this.#isCancelled = false;
    this.#cancelHandlers = [];
    this.#promise = new Promise<T>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;

      const onResolve = (value: T | PromiseLike<T>): void => {
        if (this.#isResolved || this.#isRejected || this.#isCancelled) {
          return;
        }
        this.#isResolved = true;
        if (this.#resolve) this.#resolve(value);
      };

      const onReject = (reason?: any): void => {
        if (this.#isResolved || this.#isRejected || this.#isCancelled) {
          return;
        }
        this.#isRejected = true;
        if (this.#reject) this.#reject(reason);
      };

      const onCancel = (cancelHandler: () => void): void => {
        if (this.#isResolved || this.#isRejected || this.#isCancelled) {
          return;
        }
        this.#cancelHandlers.push(cancelHandler);
      };

      Object.defineProperty(onCancel, "isResolved", {
        get: (): boolean => this.#isResolved,
      });

      Object.defineProperty(onCancel, "isRejected", {
        get: (): boolean => this.#isRejected,
      });

      Object.defineProperty(onCancel, "isCancelled", {
        get: (): boolean => this.#isCancelled,
      });

      return executor(onResolve, onReject, onCancel as OnCancel);
    });
  }

  get [Symbol.toStringTag]() {
    return "Cancellable Promise";
  }

  public then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.#promise.then(onFulfilled, onRejected);
  }

  public catch<TResult = never>(
    onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this.#promise.catch(onRejected);
  }

  public finally(onFinally?: (() => void) | null): Promise<T> {
    return this.#promise.finally(onFinally);
  }

  public cancel(): void {
    if (this.#isResolved || this.#isRejected || this.#isCancelled) {
      return;
    }
    this.#isCancelled = true;
    if (this.#cancelHandlers.length) {
      try {
        for (const cancelHandler of this.#cancelHandlers) {
          cancelHandler();
        }
      } catch (error) {
        console.warn("Cancellation threw an error", error);
        return;
      }
    }
    this.#cancelHandlers.length = 0;
    if (this.#reject) this.#reject(new CancelError("Request aborted"));
  }

  public get isCancelled(): boolean {
    return this.#isCancelled;
  }
}

// DEPRECATED
export abstract class BaseHttpRequest {
  constructor(public readonly config: OpenAPIConfig) {}

  public abstract request<T>(options: ApiRequestOptions): CancelablePromise<T>;
}
// ------------------------------end------------------------------
