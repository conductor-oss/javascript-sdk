import {
  ApiRequestOptions,
  BaseHttpRequest,
  CancelablePromise,
  OpenAPIConfig,
} from "../../common";
import { request } from "./request";

export class OrkesHttpRequest extends BaseHttpRequest {
  constructor(config: OpenAPIConfig) {
    super(config);
  }

  public request<T>(options: ApiRequestOptions): CancelablePromise<T> {
    return request(this.config, options);
  }
}
