/* chart — the ECharts-backed chart TILE. A card with an optional small uppercase
   title above a fixed-height ECharts mount slot. Sole owner of the .amu-chart-*
   classes. Data-driven: mountChart(host, {title, option, theme?, id?}) mounts an
   ECharts instance into the canvas (when an `option` + window.echarts are present)
   and wires a resize handler; with no option (or no echarts on the page) it renders
   the faded empty placeholder — never blanks the page, never throws, never logs.
   ECharts is read off window.echarts; this component NEVER imports echarts. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";
import { ensureRegisteredThemes, chartTheme, getEcharts } from "./theme.ts";
import type { EChartsInstance } from "./theme.ts";

export interface ChartTileCfg {
  title?: string;
  /** An ECharts option object (never interpolated into HTML); absent/null →
      the empty placeholder. */
  option?: unknown;
  /** A registered chart-theme name; defaults to chartTheme() for the app theme. */
  theme?: string;
  /** An id for the canvas slot (only stamped on a live, non-empty slot). */
  id?: string;
}

export interface ChartTileHandle extends MountHandle {
  canvas: HTMLElement;
  chart: EChartsInstance | null;
  resize(): void;
  setOption(opt: unknown): void;
  dispose(): void;
}

/** Build + (optionally) wire a chart tile into `host`. */
export function mountChart(host: Element, cfg: ChartTileCfg = {}): ChartTileHandle {
  const { title, option, theme, id } = cfg;
  const echarts = getEcharts();
  const empty = !option || !echarts;

  const card = el("div", {
    class: "amu-chart-card" + (empty ? " amu-chart-card--empty" : ""),
  });
  if (title) card.append(el("div", { class: "amu-chart-title" }, title));
  // Empty slots omit the canvas id (mount-lookup must never target them).
  const canvas = el("div", { class: "amu-chart-canvas", ...(!empty && id ? { id } : {}) });
  card.append(canvas);
  host.append(card);

  if (empty || !echarts) {
    return {
      el: card,
      canvas,
      chart: null,
      resize() {},
      setOption() {},
      dispose() {},
      destroy() {
        card.remove();
      },
    };
  }

  // ensureRegisteredThemes() is fire-and-forget (memoized); a cold first paint
  // may use the ECharts default theme for a few ms — accepted.
  ensureRegisteredThemes();
  const chart = echarts.init(canvas, theme || chartTheme());
  chart.setOption(option);

  const onResize = (): void => chart.resize();
  window.addEventListener("resize", onResize);

  return {
    el: card,
    canvas,
    chart,
    resize() {
      chart.resize();
    },
    setOption(opt: unknown) {
      chart.setOption(opt);
    },
    dispose() {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      card.remove();
    },
  };
}
