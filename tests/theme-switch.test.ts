// tests/theme-switch.test.ts — AC-8 (O(1) switch, assertable) + AC-10 (the
// open-ended two-axis theme.ts API) + AC-5 (back-compat read-migration).
//
// Imports the REAL src/theme/theme.ts and asserts the new contract:
//   - listThemes()/getTheme()/getMode()/setTheme()/setMode()/toggleMode()/
//     onThemeChange()/prePaintSnippet exist with the spec signatures (AC-10)
//   - setTheme(name) performs EXACTLY: one html[data-theme] write + one
//     localStorage.setItem(amu-theme) + fire listeners — NOTHING else (no
//     component DOM query, no style loop). setMode likewise on data-mode/amu-mode.
//     We spy on documentElement.querySelectorAll to prove the switch never scans
//     components (the O(1) guarantee).                                    (AC-8)
//   - getTheme()/getMode() read persisted → default (redpash + dark), and a
//     legacy amu-theme="dark" with no amu-mode migrates to ("redpash","dark"). (AC-5)
//
// RED now: today's theme.ts exports applyTheme/ThemeName="dark"|"light" and has
// NO setTheme/setMode/toggleMode/getMode/listThemes/MODE_KEY — so the import
// bindings are missing and tsc/`node --test` fail (2305/2307-class). The brief
// has the coder REPLACE applyTheme with the two-axis API (spec line 244-247 +
// CHECKPOINT-1 CMT_a8f5e4f1: applyTheme REPLACED, two-axis selector).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installDomShim } from "./_dom-shim.ts";

const shim = installDomShim();

// A localStorage stub the theme module reads/writes. node has no localStorage;
// install one before importing theme.ts so its module-init reads see it.
interface Store {
  map: Map<string, string>;
  setLog: Array<[string, string]>;
}
const store: Store = { map: new Map(), setLog: [] };
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string): string | null => (store.map.has(k) ? store.map.get(k)! : null),
  setItem: (k: string, v: string): void => {
    store.map.set(k, v);
    store.setLog.push([k, v]);
  },
  removeItem: (k: string): void => {
    store.map.delete(k);
  },
  clear: (): void => {
    store.map.clear();
  },
};

// RED until the coder widens src/theme/theme.ts to the two-axis API.
import {
  THEME_KEY,
  MODE_KEY,
  listThemes,
  getTheme,
  getMode,
  setTheme,
  setMode,
  toggleMode,
  onThemeChange,
  prePaintSnippet,
} from "../src/theme/theme.ts";

const docEl = shim.documentElement;

beforeEach(() => {
  store.map.clear();
  store.setLog.length = 0;
  // reset the two attributes the module owns
  delete docEl.dataset["theme"];
  delete docEl.dataset["mode"];
  delete docEl.attributes["data-theme"];
  delete docEl.attributes["data-mode"];
});

test("AC-10: the two-axis storage keys are the spec values", () => {
  assert.equal(THEME_KEY, "amu-theme", "theme NAME persists under amu-theme");
  assert.equal(MODE_KEY, "amu-mode", "mode persists under amu-mode");
});

test("AC-10: listThemes() returns the registered theme names (static list)", () => {
  const themes = listThemes();
  assert.ok(Array.isArray(themes), "listThemes() returns an array");
  assert.deepEqual(
    themes,
    ["redpash", "portfolio", "numu", "numu-blue"],
    "listThemes() is the showcase-cycle order redpash → portfolio → numu → numu-blue",
  );
});

test("AC-10/AC-5: getTheme()/getMode() default to redpash + dark with nothing persisted", () => {
  assert.equal(getTheme(), "redpash", "no amu-theme persisted → redpash");
  assert.equal(getMode(), "dark", "no amu-mode persisted → dark");
});

test("AC-10: getTheme()/getMode() read the persisted two-axis values", () => {
  store.map.set(THEME_KEY, "portfolio");
  store.map.set(MODE_KEY, "light");
  assert.equal(getTheme(), "portfolio");
  assert.equal(getMode(), "light");
});

test("AC-5: legacy amu-theme='dark' with no amu-mode migrates to (redpash, dark)", () => {
  // The single-axis legacy value "dark"/"light" is interpreted as the MODE; the
  // theme recovers to redpash. (Spec AC-5 + theme.ts note (2).)
  store.map.set(THEME_KEY, "dark");
  // amu-mode intentionally absent
  assert.equal(getTheme(), "redpash", "legacy 'dark' is a MODE, not a theme → redpash");
  assert.equal(getMode(), "dark", "legacy amu-theme='dark' is recovered as mode=dark");
});

test("AC-5: legacy amu-theme='light' with no amu-mode migrates to (redpash, light)", () => {
  store.map.set(THEME_KEY, "light");
  assert.equal(getTheme(), "redpash");
  assert.equal(getMode(), "light");
});

test("AC-8: setTheme(name) writes ONLY data-theme + amu-theme + fires listeners (O(1))", () => {
  const fires: Array<[string, string]> = [];
  const off = onThemeChange((theme: string, mode: string) => {
    fires.push([theme, mode]);
  });

  // Spy: the O(1) switch must NOT scan/iterate component elements.
  let qsaCalls = 0;
  const realQsa = docEl.querySelectorAll.bind(docEl);
  docEl.querySelectorAll = (sel: string) => {
    qsaCalls++;
    return realQsa(sel);
  };

  try {
    setTheme("portfolio");
  } finally {
    docEl.querySelectorAll = realQsa;
    off();
  }

  // 1) exactly the single documentElement attribute write
  assert.equal(docEl.dataset["theme"], "portfolio", "data-theme set to the new theme");
  // 2) exactly one storage write, and it is amu-theme=portfolio
  assert.deepEqual(
    store.setLog,
    [[THEME_KEY, "portfolio"]],
    "setTheme writes EXACTLY one localStorage entry: amu-theme",
  );
  // 3) listeners fired with BOTH axes
  assert.equal(fires.length, 1, "the listener fired exactly once");
  assert.deepEqual(fires[0], ["portfolio", getMode()], "listener receives (theme, mode)");
  // 4) the O(1) proof: no component DOM scan
  assert.equal(qsaCalls, 0, "setTheme must NOT querySelectorAll components (O(1) switch)");
  // 5) data-mode untouched by setTheme
  assert.equal(docEl.dataset["mode"], undefined, "setTheme does not touch data-mode");
});

test("AC-8: setMode(mode) writes ONLY data-mode + amu-mode + fires listeners (O(1))", () => {
  const fires: Array<[string, string]> = [];
  const off = onThemeChange((theme: string, mode: string) => {
    fires.push([theme, mode]);
  });

  let qsaCalls = 0;
  const realQsa = docEl.querySelectorAll.bind(docEl);
  docEl.querySelectorAll = (sel: string) => {
    qsaCalls++;
    return realQsa(sel);
  };

  try {
    setMode("light");
  } finally {
    docEl.querySelectorAll = realQsa;
    off();
  }

  assert.equal(docEl.dataset["mode"], "light", "data-mode set to the new mode");
  assert.deepEqual(
    store.setLog,
    [[MODE_KEY, "light"]],
    "setMode writes EXACTLY one localStorage entry: amu-mode",
  );
  assert.equal(fires.length, 1, "the listener fired exactly once");
  assert.deepEqual(fires[0], [getTheme(), "light"], "listener receives (theme, mode)");
  assert.equal(qsaCalls, 0, "setMode must NOT querySelectorAll components (O(1) switch)");
  assert.equal(docEl.dataset["theme"], undefined, "setMode does not touch data-theme");
});

test("AC-10: toggleMode() flips dark↔light via setMode (O(1))", () => {
  setMode("dark");
  store.setLog.length = 0;
  toggleMode();
  assert.equal(getMode(), "light", "toggle from dark → light");
  assert.deepEqual(store.setLog, [[MODE_KEY, "light"]], "toggle persists amu-mode only");

  store.setLog.length = 0;
  toggleMode();
  assert.equal(getMode(), "dark", "toggle from light → dark");
});

test("AC-10: onThemeChange returns an unsubscribe that stops further fires", () => {
  let count = 0;
  const off = onThemeChange(() => count++);
  setTheme("numu");
  assert.equal(count, 1, "subscribed listener fired once");
  off();
  setTheme("redpash");
  assert.equal(count, 1, "after unsubscribe the listener no longer fires");
});

test("AC-10: prePaintSnippet is a self-contained string that sets BOTH attributes", () => {
  assert.equal(typeof prePaintSnippet, "string", "prePaintSnippet is a string");
  assert.ok(prePaintSnippet.includes("data-theme"), "snippet sets data-theme");
  assert.ok(prePaintSnippet.includes("data-mode"), "snippet sets data-mode");
  assert.ok(prePaintSnippet.includes(THEME_KEY), "snippet reads the amu-theme key");
  assert.ok(prePaintSnippet.includes(MODE_KEY), "snippet reads the amu-mode key");
  // self-contained: an inline <head> source has no import/require.
  assert.ok(!/\bimport\b|\brequire\(/.test(prePaintSnippet), "snippet has no imports");
});

// ── Browser-walk reconciliation (CMT_7f57fd6a): getMode() must report the mode
// that prePaintSnippet ACTUALLY applied, not a hardcoded "dark" default. The
// resolution order is amu-mode → applied data-mode → legacy amu-theme → DEFAULT
// dark (the spec's Em-approved default; getMode() does NOT honor
// prefers-color-scheme). When amu-mode is unpersisted but a data-mode is applied,
// getMode() returning a constant "dark" makes the showcase label lie and the
// FIRST toggleMode() a no-op. These two are RED against the current impl
// (getMode() ignores the applied data-mode and returns the constant
// DEFAULT_MODE). ────────────────────────────────────────────────────────────

test("CMT_7f57fd6a: getMode() equals the applied data-mode when amu-mode is unpersisted", () => {
  // No persisted mode; prePaint already applied data-mode="light".
  store.map.delete(MODE_KEY);
  store.map.delete(THEME_KEY);
  docEl.dataset["mode"] = "light";
  assert.equal(
    getMode(),
    "light",
    "getMode() must report the applied data-mode (light), not the hardcoded dark default",
  );

  // And the dark case: applied data-mode="dark" → getMode()==="dark".
  docEl.dataset["mode"] = "dark";
  assert.equal(getMode(), "dark", "getMode() reports the applied data-mode (dark)");
});

test("CMT_7f57fd6a: toggleMode() flips visibly from an unpersisted light state", () => {
  // amu-mode unset; prePaint applied data-mode="light". The first toggle must
  // flip RELATIVE to the applied mode → "dark" (today it no-ops back to "light"
  // because getMode() reads the constant "dark" and toggles to "light").
  store.map.delete(MODE_KEY);
  store.map.delete(THEME_KEY);
  docEl.dataset["mode"] = "light";

  toggleMode();

  assert.equal(getMode(), "dark", "toggle from applied light flips to dark (not a no-op back to light)");
  assert.equal(docEl.dataset["mode"], "dark", "data-mode is visibly flipped to dark");
  assert.equal(store.map.get(MODE_KEY), "dark", "amu-mode persisted as dark");
});
