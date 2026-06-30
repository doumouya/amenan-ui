/* chart/theme — ECharts theme registration + resolver. The chart themes live as
   JSON the consumer hosts; ensureRegisteredThemes() fetches + registers them once
   per page-load (memoized) when window.echarts is present. chartTheme() maps the
   current app theme (html[data-theme]) → its chart-theme name, so charts carry the
   app identity. Graceful with no echarts on the page (returns a resolved Promise,
   never throws). Ported to strict TS; the theme-base path is configurable (no
   hardcoded host route). */

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

let registerP: Promise<unknown> | null = null;
let themeBase = "/chart-themes";

/** Point the theme loader at where the consumer hosts the chart-theme JSON
    (default "/chart-themes"). Call before the first chart mounts. */
export function configureChartThemes(base: string): void {
  themeBase = base.replace(/\/$/, "");
  registerP = null; // re-fetch from the new base on next ensure
}

/** Fetch + register the chart themes once (memoized). Fire-and-forget from
    chart-init paths; a cold first paint may use the ECharts default for a few ms.
    No echarts on the page → a resolved Promise (graceful no-op). */
export function ensureRegisteredThemes(): Promise<unknown> {
  if (registerP) return registerP;
  const echarts = getEcharts();
  if (!echarts) return Promise.resolve();
  registerP = Promise.all(
    THEME_NAMES.map(async (name) => {
      try {
        const r = await fetch(`${themeBase}/${name}.json`);
        if (!r.ok) return;
        echarts.registerTheme(name, await r.json());
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
