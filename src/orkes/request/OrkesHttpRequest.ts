import {
  ApiRequestOptions,
  BaseHttpRequest,
  CancelablePromise,
  OpenAPIConfig,
} from "../../common";
import { orkesRequest } from "./request";

export class OrkesHttpRequest extends BaseHttpRequest {
  constructor(config: OpenAPIConfig) {
    super(config);
  }

  public request<T>(options: ApiRequestOptions): CancelablePromise<T> {
    return orkesRequest(this.config, options);
  }
}
