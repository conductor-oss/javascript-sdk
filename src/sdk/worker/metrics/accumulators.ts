/**
 * In-memory Prometheus-compatible metric accumulators used by the
 * canonical metrics implementation.
 */

export const TIME_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

export const SIZE_BUCKETS = [
  100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000,
] as const;

export function labelKey(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(",");
}

export function renderLabels(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
}

export function exceptionLabel(error: unknown): string {
  if (error instanceof Error) {
    return error.name || error.constructor?.name || "Error";
  }
  return "Error";
}

// ── HistogramAccumulator ─────────────────────────────────────────

interface HistogramSeries {
  labels: Record<string, string>;
  buckets: number[];
  count: number;
  sum: number;
}

export class HistogramAccumulator {
  private readonly _boundaries: readonly number[];
  private _series = new Map<string, HistogramSeries>();

  constructor(boundaries: readonly number[] = TIME_BUCKETS) {
    this._boundaries = boundaries;
  }

  observe(labels: Record<string, string>, value: number): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = {
        labels,
        buckets: new Array(this._boundaries.length).fill(0),
        count: 0,
        sum: 0,
      };
      this._series.set(key, s);
    }
    for (let i = 0; i < this._boundaries.length; i++) {
      if (value <= this._boundaries[i]) {
        s.buckets[i]++;
      }
    }
    s.count++;
    s.sum += value;
  }

  render(name: string, help: string): string {
    if (this._series.size === 0) return "";
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} histogram`);
    for (const s of this._series.values()) {
      const lblStr = renderLabels(s.labels);
      const sep = lblStr ? "," : "";
      for (let i = 0; i < this._boundaries.length; i++) {
        lines.push(
          `${name}_bucket{${lblStr}${sep}le="${this._boundaries[i]}"} ${s.buckets[i]}`,
        );
      }
      lines.push(`${name}_bucket{${lblStr}${sep}le="+Inf"} ${s.count}`);
      lines.push(`${name}_sum{${lblStr}} ${s.sum}`);
      lines.push(`${name}_count{${lblStr}} ${s.count}`);
    }
    return lines.join("\n");
  }
}

// ── MultiLabelCounter ────────────────────────────────────────────

interface CounterSeries {
  labels: Record<string, string>;
  value: number;
}

export class MultiLabelCounter {
  private _series = new Map<string, CounterSeries>();

  increment(labels: Record<string, string>, value = 1): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = { labels, value: 0 };
      this._series.set(key, s);
    }
    s.value += value;
  }

  render(name: string, help: string): string {
    if (this._series.size === 0) return "";
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} counter`);
    for (const s of this._series.values()) {
      lines.push(`${name}{${renderLabels(s.labels)}} ${s.value}`);
    }
    return lines.join("\n");
  }
}

// ── GaugeMetric ──────────────────────────────────────────────────

interface GaugeSeries {
  labels: Record<string, string>;
  value: number;
}

export class GaugeMetric {
  private _series = new Map<string, GaugeSeries>();

  set(labels: Record<string, string>, value: number): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = { labels, value: 0 };
      this._series.set(key, s);
    }
    s.value = value;
  }

  inc(labels: Record<string, string>, delta = 1): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = { labels, value: 0 };
      this._series.set(key, s);
    }
    s.value += delta;
  }

  dec(labels: Record<string, string>, delta = 1): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = { labels, value: 0 };
      this._series.set(key, s);
    }
    s.value -= delta;
  }

  getValue(labels: Record<string, string>): number {
    return this._series.get(labelKey(labels))?.value ?? 0;
  }

  render(name: string, help: string): string {
    if (this._series.size === 0) return "";
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} gauge`);
    for (const s of this._series.values()) {
      lines.push(`${name}{${renderLabels(s.labels)}} ${s.value}`);
    }
    return lines.join("\n");
  }
}
