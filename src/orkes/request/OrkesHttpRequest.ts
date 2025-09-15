import {
  ApiRequestOptions,
  BaseHttpRequest,
  CancelablePromise,
  OpenAPIConfig,
} from "../../common";
import { FetchFn } from "../types";
import { orkesRequest } from "./request";
import {
  fetch as undiciFetch,
  Agent as UndiciAgent,
  RequestInfo as UndiciRequestInfo,
  RequestInit as UndiciRequestInit,
} from "undici";

export class OrkesHttpRequest extends BaseHttpRequest {
  private fetchFn: FetchFn;

  constructor(config: OpenAPIConfig, customFetch?: FetchFn) {
    super(config);

    if (customFetch) {
      this.fetchFn = customFetch;
    } else if (process?.release?.name === "node") {
      // Node.js environment - use undici to make http2 requests
      const undiciHttp2Agent = new UndiciAgent({ allowH2: true });
      const undiciHttp2Fetch = async (
        input: UndiciRequestInfo,
        init?: UndiciRequestInit
      ) => {
        return undiciFetch(input, {
          ...init,
          dispatcher: undiciHttp2Agent,
        });
      };
      this.fetchFn = undiciHttp2Fetch as FetchFn;
    } else {
      // Browser environment - use native fetch with http2 support
      this.fetchFn = fetch;
    }
  }

  public request<T>(options: ApiRequestOptions): CancelablePromise<T> {
    return orkesRequest(this.config, options, this.fetchFn);
  }
}
