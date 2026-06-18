import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import {
  getHttpMetricsObserver,
  setHttpMetricsObserver,
  safeEmit,
  type HttpMetricsObserver,
} from "../httpObserver";
import { LegacyMetricsCollector } from "../LegacyMetricsCollector";
import { CanonicalMetricsCollector } from "../CanonicalMetricsCollector";

describe("httpObserver", () => {
  beforeEach(() => {
    setHttpMetricsObserver(undefined);
  });

  it("should return undefined by default", () => {
    expect(getHttpMetricsObserver()).toBeUndefined();
  });

  it("should return the observer after setting one", () => {
    const observer: HttpMetricsObserver = {
      measurePayloadSize: false,
      recordApiRequestTime: jest.fn(),
      recordWorkflowInputSize: jest.fn(),
      recordWorkflowStartError: jest.fn(),
    };
    setHttpMetricsObserver(observer);
    expect(getHttpMetricsObserver()).toBe(observer);
  });

  it("should clear the observer when set to undefined", () => {
    const observer: HttpMetricsObserver = {
      measurePayloadSize: false,
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
      measurePayloadSize: false,
      recordApiRequestTime: jest.fn(),
      recordWorkflowInputSize: jest.fn(),
      recordWorkflowStartError: jest.fn(),
    };
    const observer2: HttpMetricsObserver = {
      measurePayloadSize: false,
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

describe("collector self-registration", () => {
  beforeEach(() => {
    setHttpMetricsObserver(undefined);
  });

  afterEach(() => {
    setHttpMetricsObserver(undefined);
  });

  it("LegacyMetricsCollector does NOT self-register as the HTTP observer", () => {
    new LegacyMetricsCollector();
    expect(getHttpMetricsObserver()).toBeUndefined();
  });

  it("CanonicalMetricsCollector self-registers as the HTTP observer", () => {
    const collector = new CanonicalMetricsCollector();
    expect(getHttpMetricsObserver()).toBe(collector);
  });
});

describe("safeEmit", () => {
  it("should run the callback when it does not throw", () => {
    const fn = jest.fn();
    safeEmit(fn, "test_metric");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should swallow and log errors thrown by the callback", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = new Error("collector blew up");

    expect(() =>
      safeEmit(() => {
        throw err;
      }, "test_metric")
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("test_metric"),
      err,
    );
    warnSpy.mockRestore();
  });
});
