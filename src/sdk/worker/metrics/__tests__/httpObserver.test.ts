import { describe, it, expect, beforeEach, jest } from "@jest/globals";
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
      recordApiRequestTime: jest.fn(),
      recordWorkflowInputSize: jest.fn(),
      recordWorkflowStartError: jest.fn(),
    };
    setHttpMetricsObserver(observer);
    expect(getHttpMetricsObserver()).toBe(observer);
  });

  it("should clear the observer when set to undefined", () => {
    const observer: HttpMetricsObserver = {
      recordApiRequestTime: jest.fn(),
      recordWorkflowInputSize: jest.fn(),
      recordWorkflowStartError: jest.fn(),
    };
    setHttpMetricsObserver(observer);
    expect(getHttpMetricsObserver()).toBe(observer);

    setHttpMetricsObserver(undefined);
    expect(getHttpMetricsObserver()).toBeUndefined();
  });

  it("should replace the observer on subsequent set calls", () => {
    const observer1: HttpMetricsObserver = {
      recordApiRequestTime: jest.fn(),
      recordWorkflowInputSize: jest.fn(),
      recordWorkflowStartError: jest.fn(),
    };
    const observer2: HttpMetricsObserver = {
      recordApiRequestTime: jest.fn(),
      recordWorkflowInputSize: jest.fn(),
      recordWorkflowStartError: jest.fn(),
    };

    setHttpMetricsObserver(observer1);
    expect(getHttpMetricsObserver()).toBe(observer1);

    setHttpMetricsObserver(observer2);
    expect(getHttpMetricsObserver()).toBe(observer2);
  });
});
