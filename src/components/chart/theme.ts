/* chart/theme — ECharts theme registration + resolver. The chart-theme JSON is
   the CONSUMER's to supply: the loader is INJECTED via configureChartThemes({load})
   (a Source<unknown> keyed by theme name) — amenan-ui hardcodes NO host route and
   issues NO fetch. ensureRegisteredThemes() runs the injected loader once per
   page-load (memoized) when window.echarts is present; with no loader configured
   it's a graceful no-op (charts use the default ECharts theme). chartTheme() maps
   the current app theme (html[data-theme]) → its chart-theme name, so charts carry
   the app identity. Graceful with no echarts on the page (returns a resolved
   Promise, never throws). Ported to strict TS. */

import type { Source } from "../../contract/index.ts";

/** The minimal ECharts surface the chart components touch — typed so reads of
    window.echarts are safe. ECharts itself is NEVER imported; the consumer loads
    it (e.g. vendor/echarts/echarts.min.js) and the components read window.echarts. */
export interface EChartsInstance {
  setOption(option: unknown): void;
  resize(): void;
  dispose(): void;
}
export interface EChartsGlobal {
  init(dom: Element, theme?: string): EChartsInstance;
  registerTheme(name: string, theme: unknown): void;
  getInstanceByDom(dom: Element): EChartsInstance | undefined;
}

/** Read window.echarts if present (graceful: undefined off-page / off-DOM). */
export function getEcharts(): EChartsGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { echarts?: EChartsGlobal }).echarts;
}

const THEME_NAMES = ["theme-mocha", "theme-latte", "theme-dark", "theme-light"];

// html[data-theme] → chart theme name. Aliases kept so a stored legacy value
// still themes correctly.
const CHART_THEME: Record<string, string> = {
  dark: "theme-dark",
  light: "theme-light",
  mocha: "theme-mocha",
  latte: "theme-latte",
};

/** How the consumer supplies chart-theme JSON. `load(name)` resolves the theme
    object for a registered name (e.g. by fetching the consumer's own host route,
    or reading a bundled module) — amenan-ui never assumes a path or transport. */
export interface ChartThemeConfig {
  /** Resolve a theme-name → its ECharts theme JSON object. */
  load: Source<unknown>;
}

let registerP: Promise<unknown> | null = null;
let themeLoad: Source<unknown> | null = null;

/** Inject the chart-theme loader. `cfg.load(name)` returns the theme JSON for a
    registered name (consumer-owned transport — no hardcoded host route here).
    Call before the first chart mounts; until configured, theme registration is a
    graceful no-op and charts use the default ECharts theme. */
export function configureChartThemes(cfg: ChartThemeConfig): void {
  themeLoad = cfg.load;
  registerP = null; // re-run the loader on next ensure
}

/** Run the injected loader + register the chart themes once (memoized).
    Fire-and-forget from chart-init paths; a cold first paint may use the ECharts
    default for a few ms. No echarts on the page, or no loader configured → a
    resolved Promise (graceful no-op). */
export function ensureRegisteredThemes(): Promise<unknown> {
  if (registerP) return registerP;
  const echarts = getEcharts();
  const load = themeLoad;
  if (!echarts || !load) return Promise.resolve();
  registerP = Promise.all(
    THEME_NAMES.map(async (name) => {
      try {
        const theme = await load({ name });
        if (theme != null) echarts.registerTheme(name, theme);
      } catch {
        /* silent — caller falls back to ECharts default */
      }
    }),
  );
  return registerP;
}

/** The chart-theme NAME for the current app theme (html[data-theme]); OS match as
    the fallback, defaulting to the dark identity. */
export function chartTheme(): string {
  const t = typeof document !== "undefined" ? document.documentElement?.dataset?.theme : undefined;
  if (t && CHART_THEME[t]) return CHART_THEME[t];
  const light =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches;
  return light ? "theme-light" : "theme-dark";
}
