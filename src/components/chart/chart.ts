/* chart — the ECharts-backed chart TILE. A card with an optional small uppercase
   title above a fixed-height ECharts mount slot. Sole owner of the .amu-chart-*
   classes. Data-driven: mountChart(host, {title, option, theme?, id?}) mounts an
   ECharts instance into the canvas (when an `option` + window.echarts are present)
   and wires a resize handler; with no option (or no echarts on the page) it renders
   the faded empty placeholder — never blanks the page, never throws, never logs.
   ECharts is read off window.echarts; this component NEVER imports echarts. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";
import { captureMountError } from "../../kernel/events.ts";
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

  /** Fall back to the faded empty placeholder (used both for the no-data case and
      when a live render throws — this component is documented to never throw). */
  function emptyHandle(): ChartTileHandle {
    card.classList.add("amu-chart-card--empty");
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

  if (empty || !echarts) return emptyHandle();

  // ensureRegisteredThemes() is fire-and-forget (memoized); a cold first paint
  // may use the ECharts default theme for a few ms — accepted.
  // echarts.init / setOption can throw on a malformed option or a vendor quirk;
  // the contract is "never throws", so render the empty placeholder AND surface
  // the failure (don't silently swallow). Per finding SF1.
  let chart: EChartsInstance;
  try {
    ensureRegisteredThemes();
    chart = echarts.init(canvas, theme || chartTheme());
    chart.setOption(option);
  } catch (e) {
    captureMountError("chart", e);
    return emptyHandle();
  }

  const onResize = (): void => {
    try {
      chart.resize();
    } catch (e) {
      captureMountError("chart", e);
    }
  };
  window.addEventListener("resize", onResize);

  return {
    el: card,
    canvas,
    chart,
    resize() {
      try {
        chart.resize();
      } catch (e) {
        captureMountError("chart", e);
      }
    },
    setOption(opt: unknown) {
      try {
        chart.setOption(opt);
      } catch (e) {
        captureMountError("chart", e);
      }
    },
    dispose() {
      window.removeEventListener("resize", onResize);
      try {
        chart.dispose();
      } catch (e) {
        captureMountError("chart", e);
      }
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      try {
        chart.dispose();
      } catch (e) {
        captureMountError("chart", e);
      }
      card.remove();
    },
  };
}
