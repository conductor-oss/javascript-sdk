/* istanbul ignore file */

import type {
  OnCancel,
  OpenAPIConfig,
  ApiResult,
  ApiRequestOptions,
} from "../../common";
import { CancelablePromise, ApiError } from "../../common";
import type { FetchFn } from "../types";

const isDefined = <T>(
  value: T | null | undefined
): value is Exclude<T, null | undefined> => {
  return value !== undefined && value !== null;
};

const isString = (value: unknown): value is string => {
  return typeof value === "string";
};

const isStringWithValue = (value: unknown): value is string => {
  return isString(value) && value !== "";
};

const isBlob = (value: unknown): value is Blob => {
  return typeof Blob !== "undefined" && value instanceof Blob;
};

const isFormData = (value: unknown): value is FormData => {
  return value instanceof FormData;
};

const base64 = (str: string): string => {
  try {
    return btoa(str);
  } catch {
    return Buffer.from(str).toString("base64");
  }
};

const getQueryString = (params: Record<string, unknown>): string => {
  const qs: string[] = [];

  const append = (key: string, value: unknown) => {
    qs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };

  const process = (key: string, value: unknown) => {
    if (isDefined(value)) {
      if (Array.isArray(value)) {
        value.forEach((v) => {
          process(key, v);
        });
      } else if (typeof value === "object" && value !== null) {
        Object.entries(value).forEach(([k, v]) => {
          process(`${key}[${k}]`, v);
        });
      } else {
        append(key, value);
      }
    }
  };

  Object.entries(params).forEach(([key, value]) => {
    process(key, value);
  });

  if (qs.length > 0) {
    return `?${qs.join("&")}`;
  }

  return "";
};

const getUrl = (config: OpenAPIConfig, options: ApiRequestOptions): string => {
  const encoder = config.ENCODE_PATH || encodeURI;

  const path = options.url
    .replace("{api-version}", config.VERSION)
    .replace(/{(.*?)}/g, (substring: string, group: string) => {
      if (
        options.path &&
        Object.prototype.hasOwnProperty.call(options.path, group)
      ) {
        return encoder(String(options.path[group]));
      }
      return substring;
    });

  const url = `${config.BASE}${path}`;
  if (options.query) {
    return `${url}${getQueryString(options.query)}`;
  }
  return url;
};

const getFormData = (options: ApiRequestOptions): FormData | undefined => {
  if (options.formData) {
    const formData = new FormData();

    const process = (key: string, value: unknown) => {
      if (isString(value) || isBlob(value)) {
        formData.append(key, value);
      } else {
        formData.append(key, JSON.stringify(value));
      }
    };

    Object.entries(options.formData)
      .filter(([, value]) => isDefined(value))
      .forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => process(key, v));
        } else {
          process(key, value);
        }
      });

    return formData;
  }
  return undefined;
};

type Resolver<T> = (options: ApiRequestOptions) => Promise<T>;

const resolve = async <T>(
  options: ApiRequestOptions,
  resolver?: T | Resolver<T>
): Promise<T | undefined> => {
  if (typeof resolver === "function") {
    return (resolver as Resolver<T>)(options);
  }
  return resolver;
};

const getHeaders = async (
  config: OpenAPIConfig,
  options: ApiRequestOptions
): Promise<Headers> => {
  const token = await resolve(options, config.TOKEN);
  const username = await resolve(options, config.USERNAME);
  const password = await resolve(options, config.PASSWORD);
  const additionalHeaders = await resolve(options, config.HEADERS);

  const headers = Object.entries({
    Accept: "application/json",
    ...additionalHeaders,
    ...options.headers,
  })
    .filter(([, value]) => isDefined(value))
    .reduce(
      (headers, [key, value]) => ({
        ...headers,
        [key]: String(value),
      }),
      {} as Record<string, string>
    );

  if (isStringWithValue(token)) {
    headers["X-AUTHORIZATION"] = token;
  }

  if (isStringWithValue(username) && isStringWithValue(password)) {
    const credentials = base64(`${username}:${password}`);
    headers["Authorization"] = `Basic ${credentials}`;
  }

  if (options.body) {
    if (options.mediaType) {
      headers["Content-Type"] = options.mediaType;
    } else if (isBlob(options.body)) {
      headers["Content-Type"] = "application/octet-stream";
    } else if (isString(options.body)) {
      headers["Content-Type"] = "text/plain";
    } else if (!isFormData(options.body)) {
      headers["Content-Type"] = "application/json";
    }
  }

  return new Headers(headers);
};

const getRequestBody = (options: ApiRequestOptions): BodyInit | undefined => {
  if (options.body) {
    if (options.mediaType?.includes("/json")) {
      return JSON.stringify(options.body);
    } else if (
      isString(options.body) ||
      isBlob(options.body) ||
      isFormData(options.body)
    ) {
      return options.body;
    } else {
      return JSON.stringify(options.body);
    }
  }
  return undefined;
};

const fetchWithRetry = async (
  url: string,
  request: RequestInit,
  fetchFn: FetchFn<RequestInit, Response>,
  retries = 5,
  delay = 1000
): Promise<Response> => {
  const response = await fetchFn(url, request);
  if (response.status == 429 && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(url, request, fetchFn, retries - 1, delay * 2);
  }
  return response;
};

const sendRequest = async (
  options: ApiRequestOptions,
  url: string,
  body: BodyInit | undefined,
  formData: FormData | undefined,
  headers: Headers,
  onCancel: OnCancel,
  fetchFn: FetchFn<RequestInit, Response> = fetch
): Promise<Response> => {
  const controller = new AbortController();

  const request: RequestInit = {
    headers,
    method: options.method,
    body: body ?? formData,
    signal: controller.signal as AbortSignal,
  };

  onCancel(() => controller.abort());

  return await fetchWithRetry(url, request, fetchFn);
};

const getResponseHeader = (
  response: Response,
  responseHeader?: string
): string | undefined => {
  if (responseHeader) {
    const content = response.headers.get(responseHeader);
    if (isString(content)) {
      return content;
    }
  }
  return undefined;
};

const getResponseBody = async (
  response: Response
): Promise<Response | string | undefined> => {
  if (response.status !== 204) {
    try {
      const contentType = response.headers.get("Content-Type");
      if (contentType) {
        const isJSON = contentType.toLowerCase().startsWith("application/json");
        if (isJSON) {
          return await response.json();
        } else {
          return await response.text();
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
  return undefined;
};

const catchErrorCodes = (
  options: ApiRequestOptions,
  result: ApiResult
): void => {
  const errors: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    ...options.errors,
  };

  const error = errors[result.status];
  if (error) {
    throw new ApiError(options, result, error);
  }

  if (!result.ok) {
    throw new ApiError(options, result, "Generic Error");
  }
};

/**
 * Request method
 * @param config The OpenAPI configuration object
 * @param options The request options from the service
 * @returns CancelablePromise<T>
 * @throws ApiError
 */
export const request = <T>(
  config: OpenAPIConfig,
  options: ApiRequestOptions,
  fetchFn: FetchFn = fetch
): CancelablePromise<T> => {
  return new CancelablePromise(async (resolve, reject, onCancel) => {
    try {
      const url = getUrl(config, options);
      const formData = getFormData(options);
      const body = getRequestBody(options);
      const headers = await getHeaders(config, options);

      if (!onCancel.isCancelled) {
        const response = await sendRequest(
          options,
          url,
          body,
          formData,
          headers,
          onCancel,
          fetchFn
        );
        const responseBody = await getResponseBody(response);
        const responseHeader = getResponseHeader(
          response,
          options.responseHeader
        );

        const result: ApiResult = {
          url,
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseHeader ?? responseBody,
        };

        catchErrorCodes(options, result);

        resolve(result.body);
      }
    } catch (error) {
      reject(error);
    }
  });
};
