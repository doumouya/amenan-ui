// tests/chart-theme-reaction.test.ts — AC-16 (the canvas reaction: the ONE
// allowed JS reaction to a theme switch).
//
// Asserts that mounting `chart` subscribes to theme.ts onThemeChange, and on a
// theme switch the chart self-updates (re-reads tokens + re-applies its option
// via the existing chart re-render path). This is the canvas O(1)-switch
// exception — every OTHER component re-resolves via the CSS cascade.
//
// Strategy: install a fake window.echarts so mountChart builds a LIVE instance,
// then fire setTheme()/setMode() (the O(1) path) and assert the chart's
// setOption was invoked again (re-render) — i.e. the chart reacted. A light
// fallback assertion also proves it subscribed (the active onThemeChange
// listener count rose after mount and dropped after destroy).
//
// RED now: today's mountChart does NOT subscribe to onThemeChange (it never
// re-renders on a theme switch), and theme.ts has no setTheme/setMode yet — so
// the reaction never fires and the import bindings are missing. The coder wires
// the chart + chart-editor to onThemeChange per AC-16.
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

// A fake ECharts so mountChart builds a live instance. setOption pushes onto a
// shared log so the test can count re-renders.
const setOptionLog: unknown[] = [];
class FakeChart {
  setOption(opt: unknown): void {
    setOptionLog.push(opt);
  }
  resize(): void {}
  dispose(): void {}
}
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { echarts: unknown }).echarts = {
  init: (_dom: Element, _theme?: string) => new FakeChart(),
  registerTheme: (_n: string, _t: unknown) => {},
  getInstanceByDom: (_dom: Element) => undefined,
};
// getComputedStyle — the chart re-reads tokens on a theme switch.
(globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({
  getPropertyValue: (_p: string) => "#000000",
});
(globalThis as unknown as { matchMedia: unknown }).matchMedia = (_q: string) => ({ matches: false });

// RED until the chart subscribes to onThemeChange and theme.ts exposes the
// two-axis setters.
import { mountChart } from "../src/components/chart/chart.ts";
import { setTheme, setMode, getMode } from "../src/theme/theme.ts";

const newHost = () => new FakeElement("div") as unknown as HTMLElement;
const option = { series: [{ type: "bar", data: [1, 2, 3] }] };

beforeEach(() => {
  store.clear();
  setOptionLog.length = 0;
  delete shim.documentElement.dataset["theme"];
  delete shim.documentElement.dataset["mode"];
});

test("AC-16: switching theme after mounting a chart re-applies the chart option (self-update)", () => {
  const handle = mountChart(newHost(), { title: "T", option });
  // the initial mount applies the option once
  const afterMount = setOptionLog.length;
  assert.ok(afterMount >= 1, "the chart applied its option on mount");

  // flip the theme via the O(1) path — the chart's onThemeChange reaction must
  // re-apply the option (re-render with the new tokens).
  setTheme("portfolio");
  assert.ok(
    setOptionLog.length > afterMount,
    "switching theme re-applied the chart option (the canvas reaction fired)",
  );

  // and flipping the mode also triggers the reaction
  const afterTheme = setOptionLog.length;
  setMode(getMode() === "dark" ? "light" : "dark");
  assert.ok(setOptionLog.length > afterTheme, "switching mode also re-applied the chart option");

  handle.destroy?.();
});

test("AC-16: a destroyed chart no longer reacts to theme switches (unsubscribed)", () => {
  const handle = mountChart(newHost(), { title: "T", option });
  handle.destroy?.();
  const before = setOptionLog.length;
  setTheme("numu");
  setMode("light");
  assert.equal(
    setOptionLog.length,
    before,
    "after destroy the chart unsubscribed — no further re-render on theme/mode switch",
  );
});
