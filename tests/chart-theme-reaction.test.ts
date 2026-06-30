// tests/chart-theme-reaction.test.ts — AC-16 (the canvas reaction: the ONE
// allowed JS reaction to a theme switch).
//
// Asserts that mounting `chart` subscribes to theme.ts onThemeChange, and on a
// theme/mode switch the chart RE-COLORS. ECharts binds its theme at
// `init(canvas, theme)` time — it is NOT a setOption-mutable property — so the
// ONLY effective recolor is to DISPOSE the prior instance and RE-INIT with the
// freshly-resolved theme, then re-apply the held option. A reaction that merely
// calls setOption(current) on the same (already init-bound) instance does NOT
// recolor the chart and is therefore a non-fix. This suite models the init-bound
// theme so that non-fix is caught.
//
// Strategy: install a fake window.echarts whose `init(canvas, theme)` records
// every init (canvas + theme arg + call count) and returns a fresh FakeChart;
// FakeChart records its own dispose(). Mounting builds a LIVE instance, then we
// fire setTheme()/setMode() (the O(1) path) and assert the reaction DISPOSED the
// prior instance and RE-INIT'd (init count +1 per switch) with the re-resolved
// theme — not merely another setOption on the same instance. We also assert the
// held option is re-applied after re-init, and that destroy() unsubscribes (no
// re-init after teardown).
//
// RED now: today's mountChart reacts with `chart.setOption(current)` on the SAME
// init-bound instance — it never disposes + re-inits — so the init call-count
// stays at 1 across theme/mode switches and the prior instance is never disposed.
// The coder switches the reaction to dispose + re-init to make this GREEN.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installDomShim, FakeElement } from "./_dom-shim.ts";

const shim = installDomShim();

// theme.ts needs localStorage.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string): string | null => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string): void => {
    store.set(k, v);
  },
  removeItem: (k: string): void => {
    store.delete(k);
  },
  clear: (): void => store.clear(),
};

// A fake ECharts that models ECharts' init-bound theme. Each FakeChart records
// the setOptions it received and whether it was disposed. echarts.init records
// every call (the canvas + the theme arg) — a re-init shows up as a new initLog
// entry and a fresh chart instance.
class FakeChart {
  readonly setOptions: unknown[] = [];
  disposed = false;
  setOption(opt: unknown): void {
    this.setOptions.push(opt);
  }
  resize(): void {}
  dispose(): void {
    this.disposed = true;
  }
}
interface InitRecord {
  dom: unknown;
  theme: string | undefined;
  chart: FakeChart;
}
const initLog: InitRecord[] = [];
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { echarts: unknown }).echarts = {
  init: (dom: Element, theme?: string) => {
    const chart = new FakeChart();
    initLog.push({ dom, theme, chart });
    return chart;
  },
  registerTheme: (_n: string, _t: unknown) => {},
  getInstanceByDom: (_dom: Element) => undefined,
};
// getComputedStyle — the chart re-reads tokens on a theme switch.
(globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({
  getPropertyValue: (_p: string) => "#000000",
});
(globalThis as unknown as { matchMedia: unknown }).matchMedia = (_q: string) => ({ matches: false });

// RED until the chart's reaction disposes + re-inits (instead of setOption-only)
// and theme.ts exposes the two-axis setters.
import { mountChart } from "../src/components/chart/chart.ts";
import { setTheme, setMode, getMode } from "../src/theme/theme.ts";

const newHost = () => new FakeElement("div") as unknown as HTMLElement;
const option = { series: [{ type: "bar", data: [1, 2, 3] }] };

const lastInit = (): InitRecord => initLog[initLog.length - 1]!;

beforeEach(() => {
  store.clear();
  initLog.length = 0;
  delete shim.documentElement.dataset["theme"];
  delete shim.documentElement.dataset["mode"];
});

test("AC-16: a theme switch DISPOSES the prior chart and RE-INITs (not a same-instance setOption)", () => {
  const handle = mountChart(newHost(), { title: "T", option });

  // mount inits exactly once and applies the option on that instance.
  assert.equal(initLog.length, 1, "mount called echarts.init exactly once");
  const first = lastInit().chart;
  assert.ok(first.setOptions.length >= 1, "the option was applied on the initial instance");
  assert.equal(first.disposed, false, "the initial instance is live after mount");

  // Flip the theme via the O(1) path. ECharts binds its theme at init() — so the
  // ONLY effective recolor is dispose + re-init. Assert exactly that:
  setTheme("portfolio");
  assert.equal(
    initLog.length,
    2,
    "a theme switch RE-INIT'd the chart (echarts.init call-count rose by 1) — a same-instance setOption is NOT a recolor",
  );
  assert.equal(first.disposed, true, "the prior chart instance was disposed before re-init");
  const second = lastInit().chart;
  assert.notStrictEqual(second, first, "re-init produced a fresh chart instance");
  // the re-init re-resolves the chart theme via chartTheme() (mode-keyed: default dark).
  assert.equal(lastInit().theme, "theme-dark", "re-init resolved the chart theme for the current mode");
  // and the held option is re-applied onto the fresh instance.
  assert.ok(
    second.setOptions.some((o) => o === option),
    "the held option was re-applied after re-init",
  );

  // Flipping the MODE also disposes + re-inits, with the re-resolved (light) theme.
  const before = initLog.length;
  setMode(getMode() === "dark" ? "light" : "dark");
  assert.equal(initLog.length, before + 1, "a mode switch also RE-INIT'd the chart");
  assert.equal(second.disposed, true, "the prior instance was disposed on the mode switch too");
  const third = lastInit().chart;
  assert.equal(lastInit().theme, "theme-light", "re-init tracked the new mode (light)");
  assert.ok(
    third.setOptions.some((o) => o === option),
    "the held option was re-applied after the mode-switch re-init",
  );

  handle.destroy?.();
});

test("AC-16: a destroyed chart no longer reacts to theme switches (no re-init after teardown)", () => {
  const handle = mountChart(newHost(), { title: "T", option });
  assert.equal(initLog.length, 1, "mount inited once");
  handle.destroy?.();
  const before = initLog.length;
  setTheme("numu");
  setMode("light");
  assert.equal(
    initLog.length,
    before,
    "after destroy the chart unsubscribed — no further re-init on a theme/mode switch",
  );
});
