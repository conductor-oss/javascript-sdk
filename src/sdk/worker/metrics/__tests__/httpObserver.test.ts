import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  getHttpMetricsObserver,
  setHttpMetricsObserver,
  type HttpMetricsObserver,
} from "../httpObserver";

describe("httpObserver", () => {
  beforeEach(() => {
    setHttpMetricsObserver(undefined);
  });

  it("should return undefined by default", () => {
    expect(getHttpMetricsObserver()).toBeUndefined();
  });

  it("should return the observer after setting one", () => {
    const observer: HttpMetricsObserver = {
      recordApiRequestTime: () => {},
      recordWorkflowInputSize: () => {},
      recordWorkflowStartError: () => {},
    };
    setHttpMetricsObserver(observer);
    expect(getHttpMetricsObserver()).toBe(observer);
  });

  it("should clear the observer when set to undefined", () => {
    const observer: HttpMetricsObserver = {
      recordApiRequestTime: () => {},
      recordWorkflowInputSize: () => {},
      recordWorkflowStartError: () => {},
    };
    setHttpMetricsObserver(observer);
    expect(getHttpMetricsObserver()).toBe(observer);

    setHttpMetricsObserver(undefined);
    expect(getHttpMetricsObserver()).toBeUndefined();
  });

  it("should replace the observer on subsequent set calls", () => {
    const observer1: HttpMetricsObserver = {
      recordApiRequestTime: () => {},
      recordWorkflowInputSize: () => {},
      recordWorkflowStartError: () => {},
    };
    const observer2: HttpMetricsObserver = {
      recordApiRequestTime: () => {},
      recordWorkflowInputSize: () => {},
      recordWorkflowStartError: () => {},
    };

    setHttpMetricsObserver(observer1);
    expect(getHttpMetricsObserver()).toBe(observer1);

    setHttpMetricsObserver(observer2);
    expect(getHttpMetricsObserver()).toBe(observer2);
  });
});
