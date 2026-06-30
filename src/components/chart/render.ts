/* chart/render — chart spec → live ECharts instance, + the data-shaping helpers
   that turn aggregated rows into the `cfg.option` shape buildOption reads. The
   data comes from the consumer's aggregation source, shaped by synthesizeOption()
   into cfg.option, then rendered here. Graceful with no echarts (returns null,
   never throws). Ported to strict TS. */

import { THEMES, buildOption } from "./build.ts";
import type { BakedOption, ChartCfg } from "./build.ts";
import { ensureRegisteredThemes, getEcharts } from "./theme.ts";
import type { EChartsInstance } from "./theme.ts";

/** A {name, value} | {label: number} | {name, count} item shape the shaping
    helpers accept. */
type NameValueLike = { name?: unknown; label?: unknown; value?: unknown; count?: unknown };

// ── shape aggregated rows ({name,value}[] | {label:number} | label/value columns)
//    into the cfg.option shape buildOption reads. ──────────────────────────────
export function synthesizeOption(data: unknown, kind?: string): BakedOption | null {
  if (data == null) return null;
  if (typeof data === "number") return { series: [{ data: [data] }] };
  if (kind === "pie" || kind === "radar") {
    return { series: [{ data: normaliseToNameValue(data) }] };
  }
  const { labels, values } = normaliseToLabelsValues(data);
  return {
    xAxis: { data: labels },
    yAxis: { data: labels }, // barh reads from yAxis; harmless on others
    series: [{ data: values }],
  };
}

function normaliseToNameValue(input: unknown): { name: string; value: number }[] {
  if (Array.isArray(input)) {
    return (input as NameValueLike[])
      .filter((d) => d && (d.name ?? d.label) != null)
      .map((d) => ({
        name: String(d.name ?? d.label),
        value: Number(d.value ?? d.count ?? 0),
      }));
  }
  if (input && typeof input === "object") {
    return Object.entries(input as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number" && !Number.isNaN(v))
      .map(([name, value]) => ({ name, value: value as number }));
  }
  return [];
}

function normaliseToLabelsValues(input: unknown): { labels: string[]; values: number[] } {
  const items = normaliseToNameValue(input);
  return { labels: items.map((i) => i.name), values: items.map((i) => i.value) };
}

/** A render spec: the chart `cfg` (carrying the baked option upstream). */
export interface RenderSpec {
  cfg?: ChartCfg;
}

// ── renderChart: build the option from cfg + mount/replace the instance. ──────
// `slot` is the DOM node; `spec` = { cfg } (cfg.option already carries the data,
// stamped by synthesizeOption upstream); `themeName` defaults to cfg.theme.
// Returns the ECharts instance (or null with no echarts / no slot).
export function renderChart(
  slot: Element | null,
  spec: RenderSpec,
  themeName?: string,
): EChartsInstance | null {
  const echarts = getEcharts();
  if (!slot || !echarts) return null;
  ensureRegisteredThemes();
  const cfg: ChartCfg = { ...(spec.cfg || {}) };
  const themeKey = themeName || cfg.theme || "vintage";
  const t = THEMES[themeKey] ?? THEMES["vintage"]!;
  const themeForInit = t.registered ? themeKey : undefined;
  // One ECharts instance per DOM node — dispose any existing before re-init.
  const existing = echarts.getInstanceByDom(slot);
  if (existing) {
    try {
      existing.dispose();
    } catch {
      /* already gone */
    }
  }
  const inst = echarts.init(slot, themeForInit);
  inst.setOption(buildOption(cfg, t));
  return inst;
}
