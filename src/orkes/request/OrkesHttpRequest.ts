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

  constructor(config: OpenAPIConfig) {
    super(config);
    const undiciHttp2Agent = new UndiciAgent({ allowH2: true });
    const undiciHttp2Fetch = async (
      input: UndiciRequestInfo,
      init: UndiciRequestInit = {}
    ) => {
      return undiciFetch(input, {
        ...init,
        dispatcher: undiciHttp2Agent,
      });
    };
    this.fetchFn = undiciHttp2Fetch as FetchFn;
  }

  public request<T>(options: ApiRequestOptions): CancelablePromise<T> {
    return orkesRequest(this.config, options, this.fetchFn);
  }
}
