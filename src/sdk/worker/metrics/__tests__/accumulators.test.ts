import { describe, it, expect } from "@jest/globals";
import {
  labelKey,
  renderLabels,
  exceptionLabel,
  HistogramAccumulator,
  MultiLabelCounter,
  GaugeMetric,
  TIME_BUCKETS,
  SIZE_BUCKETS,
} from "../accumulators";

describe("labelKey", () => {
  it("should return empty string for empty labels", () => {
    expect(labelKey({})).toBe("");
  });

  it("should return key=value for a single label", () => {
    expect(labelKey({ taskType: "my_task" })).toBe("taskType=my_task");
  });

  it("should sort keys alphabetically", () => {
    expect(labelKey({ z: "1", a: "2", m: "3" })).toBe("a=2,m=3,z=1");
  });

  it("should produce the same key regardless of insertion order", () => {
    const key1 = labelKey({ status: "SUCCESS", taskType: "t" });
    const key2 = labelKey({ taskType: "t", status: "SUCCESS" });
    expect(key1).toBe(key2);
  });
});

describe("renderLabels", () => {
  it("should return empty string for empty labels", () => {
    expect(renderLabels({})).toBe("");
  });

  it("should format a single label with quotes", () => {
    expect(renderLabels({ taskType: "my_task" })).toBe('taskType="my_task"');
  });

  it("should format multiple labels comma-separated", () => {
    const result = renderLabels({ method: "GET", uri: "/api" });
    expect(result).toBe('method="GET",uri="/api"');
  });
});

describe("exceptionLabel", () => {
  it("should return Error name for standard Error", () => {
    expect(exceptionLabel(new Error("oops"))).toBe("Error");
  });

  it("should return subclass name for TypeError", () => {
    expect(exceptionLabel(new TypeError("bad type"))).toBe("TypeError");
  });

  it("should return subclass name for RangeError", () => {
    expect(exceptionLabel(new RangeError("out of range"))).toBe("RangeError");
  });

  it("should return 'Error' for non-Error values", () => {
    expect(exceptionLabel("string error")).toBe("Error");
    expect(exceptionLabel(42)).toBe("Error");
    expect(exceptionLabel(null)).toBe("Error");
    expect(exceptionLabel(undefined)).toBe("Error");
    expect(exceptionLabel({ message: "not an error" })).toBe("Error");
  });

  it("should fall back to constructor name when .name is empty", () => {
    const err = new TypeError("test");
    Object.defineProperty(err, "name", { value: "" });
    expect(exceptionLabel(err)).toBe("TypeError");
  });
});

describe("HistogramAccumulator", () => {
  it("should render empty string when no observations", () => {
    const h = new HistogramAccumulator([1, 5, 10]);
    expect(h.render("test_metric", "A test")).toBe("");
  });

  it("should place value in correct buckets", () => {
    const h = new HistogramAccumulator([1, 5, 10]);
    h.observe({ taskType: "t" }, 3);

    const text = h.render("req_time", "Request time");
    expect(text).toContain("# HELP req_time Request time");
    expect(text).toContain("# TYPE req_time histogram");
    expect(text).toContain('req_time_bucket{taskType="t",le="1"} 0');
    expect(text).toContain('req_time_bucket{taskType="t",le="5"} 1');
    expect(text).toContain('req_time_bucket{taskType="t",le="10"} 1');
    expect(text).toContain('req_time_bucket{taskType="t",le="+Inf"} 1');
    expect(text).toContain('req_time_sum{taskType="t"} 3');
    expect(text).toContain('req_time_count{taskType="t"} 1');
  });

  it("should increment all buckets at or above the value boundary", () => {
    const h = new HistogramAccumulator([1, 5, 10]);
    h.observe({}, 1); // exactly on boundary

    const text = h.render("m", "help");
    expect(text).toContain('m_bucket{le="1"} 1');
    expect(text).toContain('m_bucket{le="5"} 1');
    expect(text).toContain('m_bucket{le="10"} 1');
  });

  it("should handle value above all boundaries", () => {
    const h = new HistogramAccumulator([1, 5, 10]);
    h.observe({}, 100);

    const text = h.render("m", "help");
    expect(text).toContain('m_bucket{le="1"} 0');
    expect(text).toContain('m_bucket{le="5"} 0');
    expect(text).toContain('m_bucket{le="10"} 0');
    expect(text).toContain('m_bucket{le="+Inf"} 1');
    expect(text).toContain("m_sum{} 100");
  });

  it("should accumulate multiple observations", () => {
    const h = new HistogramAccumulator([1, 5, 10]);
    h.observe({ t: "a" }, 0.5);
    h.observe({ t: "a" }, 3);
    h.observe({ t: "a" }, 7);

    const text = h.render("m", "help");
    expect(text).toContain('m_bucket{t="a",le="1"} 1');
    expect(text).toContain('m_bucket{t="a",le="5"} 2');
    expect(text).toContain('m_bucket{t="a",le="10"} 3');
    expect(text).toContain('m_count{t="a"} 3');
    expect(text).toContain('m_sum{t="a"} 10.5');
  });

  it("should track separate series for different label sets", () => {
    const h = new HistogramAccumulator([10]);
    h.observe({ status: "OK" }, 5);
    h.observe({ status: "ERR" }, 15);

    const text = h.render("m", "help");
    expect(text).toContain('m_bucket{status="OK",le="10"} 1');
    expect(text).toContain('m_bucket{status="ERR",le="10"} 0');
    expect(text).toContain('m_count{status="OK"} 1');
    expect(text).toContain('m_count{status="ERR"} 1');
  });

  it("should default to TIME_BUCKETS when no boundaries given", () => {
    const h = new HistogramAccumulator();
    h.observe({}, 0.005);
    const text = h.render("m", "help");
    // TIME_BUCKETS starts at 0.001, 0.005, ...
    expect(text).toContain('le="0.001"');
    expect(text).toContain('le="0.005"');
  });
});

describe("MultiLabelCounter", () => {
  it("should render empty string when no increments", () => {
    const c = new MultiLabelCounter();
    expect(c.render("test_counter", "A test")).toBe("");
  });

  it("should increment and render a single-label counter", () => {
    const c = new MultiLabelCounter();
    c.increment({ taskType: "t" });
    c.increment({ taskType: "t" });

    const text = c.render("poll_total", "Total polls");
    expect(text).toContain("# HELP poll_total Total polls");
    expect(text).toContain("# TYPE poll_total counter");
    expect(text).toContain('poll_total{taskType="t"} 2');
  });

  it("should support custom increment values", () => {
    const c = new MultiLabelCounter();
    c.increment({ taskType: "t" }, 5);
    c.increment({ taskType: "t" }, 3);

    const text = c.render("m", "help");
    expect(text).toContain('m{taskType="t"} 8');
  });

  it("should track separate series for different label sets", () => {
    const c = new MultiLabelCounter();
    c.increment({ taskType: "a" });
    c.increment({ taskType: "b" });
    c.increment({ taskType: "a" });

    const text = c.render("m", "help");
    expect(text).toContain('m{taskType="a"} 2');
    expect(text).toContain('m{taskType="b"} 1');
  });

  it("should handle multi-label counters", () => {
    const c = new MultiLabelCounter();
    c.increment({ taskType: "t", exception: "TypeError" });

    const text = c.render("err", "Errors");
    expect(text).toContain('err{taskType="t",exception="TypeError"} 1');
  });
});

describe("GaugeMetric", () => {
  it("should render empty string when no values set", () => {
    const g = new GaugeMetric();
    expect(g.render("test_gauge", "A test")).toBe("");
  });

  it("should set and render a gauge value", () => {
    const g = new GaugeMetric();
    g.set({ taskType: "t" }, 42);

    const text = g.render("active", "Active workers");
    expect(text).toContain("# HELP active Active workers");
    expect(text).toContain("# TYPE active gauge");
    expect(text).toContain('active{taskType="t"} 42');
  });

  it("should overwrite previous value on set", () => {
    const g = new GaugeMetric();
    g.set({ taskType: "t" }, 10);
    g.set({ taskType: "t" }, 99);

    const text = g.render("m", "help");
    expect(text).toContain('m{taskType="t"} 99');
    expect(text).not.toContain("10");
  });

  it("should increment with inc()", () => {
    const g = new GaugeMetric();
    g.inc({ taskType: "t" });
    g.inc({ taskType: "t" });
    g.inc({ taskType: "t" }, 3);

    expect(g.getValue({ taskType: "t" })).toBe(5);
  });

  it("should decrement with dec()", () => {
    const g = new GaugeMetric();
    g.inc({ taskType: "t" }, 5);
    g.dec({ taskType: "t" });
    g.dec({ taskType: "t" }, 2);

    expect(g.getValue({ taskType: "t" })).toBe(2);
  });

  it("should allow negative values after dec()", () => {
    const g = new GaugeMetric();
    g.dec({ taskType: "t" });

    expect(g.getValue({ taskType: "t" })).toBe(-1);
  });

  it("should return 0 for getValue on unknown labels", () => {
    const g = new GaugeMetric();
    expect(g.getValue({ taskType: "unknown" })).toBe(0);
  });

  it("should track separate series for different label sets", () => {
    const g = new GaugeMetric();
    g.set({ taskType: "a" }, 10);
    g.set({ taskType: "b" }, 20);

    expect(g.getValue({ taskType: "a" })).toBe(10);
    expect(g.getValue({ taskType: "b" })).toBe(20);

    const text = g.render("m", "help");
    expect(text).toContain('m{taskType="a"} 10');
    expect(text).toContain('m{taskType="b"} 20');
  });
});

describe("bucket constants", () => {
  it("TIME_BUCKETS should be sorted ascending", () => {
    for (let i = 1; i < TIME_BUCKETS.length; i++) {
      expect(TIME_BUCKETS[i]).toBeGreaterThan(TIME_BUCKETS[i - 1]);
    }
  });

  it("SIZE_BUCKETS should be sorted ascending", () => {
    for (let i = 1; i < SIZE_BUCKETS.length; i++) {
      expect(SIZE_BUCKETS[i]).toBeGreaterThan(SIZE_BUCKETS[i - 1]);
    }
  });
});
