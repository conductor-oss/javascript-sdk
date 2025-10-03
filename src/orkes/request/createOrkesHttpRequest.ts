import {
  ApiRequestOptions,
  BaseHttpRequest,
  CancelablePromise,
} from "../../common";
import { FetchFn } from "../types";
import { request as orkesRequest } from "./request";

export function createOrkesHttpRequest(fetchFn?: FetchFn) {
  return class OrkesHttpRequest extends BaseHttpRequest {
    public request<T>(options: ApiRequestOptions): CancelablePromise<T> {
      return orkesRequest(this.config, options, fetchFn);
    }
  };
}
