/* theme.ts — the open-ended TWO-AXIS theme seam (AC-10). amenan-ui is an
   extensible theme platform: a `theme` NAME (redpash / portfolio / numu / any
   future client) × a `mode` (dark | light), keyed on
   `html[data-theme="<name>"]` × `html[data-mode="<mode>"]`. This module is the
   only runtime that reads/writes the choice — no service, no framework: two
   document attributes + a localStorage mirror under `amu-theme` + `amu-mode`.

   The switch is O(1) (AC-8): setTheme/setMode write EXACTLY one documentElement
   attribute + one localStorage entry + fire listeners — nothing else (no DOM
   query of components, no style loop, no re-mount). Everything else re-resolves
   through the CSS cascade; the sole allowed JS reaction is the chart canvas
   (chart/theme.ts re-reads tokens via getComputedStyle).

   Back-compat (AC-5): a legacy single-axis persisted `amu-theme` of "dark"/"light"
   (no `amu-mode`) is interpreted as the MODE, with the theme recovered to
   "redpash" — the old default look still renders, and the platform writes the
   two-axis attributes going forward.

   `prePaintSnippet` is the inline <head> script SOURCE a host embeds before first
   paint so the persisted theme+mode are applied with zero FOUC. */

/** A theme NAME — ANY registered theme. Open-ended (not a closed union). */
export type ThemeName = string;
/** The light/dark axis. */
export type Mode = "dark" | "light";

/** localStorage key — persists the theme NAME. */
export const THEME_KEY = "amu-theme";
/** localStorage key — persists the MODE. */
export const MODE_KEY = "amu-mode";

/** Fallbacks when nothing is persisted (match the :root default = redpash+dark). */
const DEFAULT_THEME: ThemeName = "redpash";
const DEFAULT_MODE: Mode = "dark";

/** The registered theme names, in showcase-cycle order. Static list — NO DOM
    scan (the O(1) guarantee: switching never enumerates the document). Adding a
    theme appends its name here (see the THEME.md add-a-theme recipe). */
const THEMES: readonly ThemeName[] = ["redpash", "portfolio", "numu", "numu-blue"];

/** The registered theme names, in showcase-cycle order. */
export function listThemes(): ThemeName[] {
  return [...THEMES];
}

const listeners = new Set<(theme: ThemeName, mode: Mode) => void>();

function isMode(v: unknown): v is Mode {
  return v === "dark" || v === "light";
}

/** Read a persisted localStorage value, tolerant of no-storage (private mode /
    worker). Never throws. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The mode currently APPLIED to html[data-mode] (what prePaint set), tolerant of
    no-document (worker). Never throws. */
function appliedMode(): Mode | null {
  try {
    const m = document.documentElement?.dataset?.mode;
    return isMode(m) ? m : null;
  } catch {
    return null;
  }
}

/** Read the persisted theme NAME → default "redpash". A LEGACY single-axis value
    ("dark"/"light") persisted under amu-theme is NOT a theme — it is the old
    mode value, so the theme recovers to the default (AC-5). */
export function getTheme(): ThemeName {
  const t = read(THEME_KEY);
  if (t && !isMode(t)) return t;
  return DEFAULT_THEME;
}

/** Resolve the MODE the SAME way prePaintSnippet applies it, so getMode() never
    disagrees with the rendered html[data-mode] (CMT_7f57fd6a). The chain:
      1. persisted amu-mode               — the explicit, persisted choice
      2. the applied html[data-mode]      — what prePaint actually rendered
      3. legacy amu-theme="dark"/"light"  — AC-5 back-compat (read as the mode)
      4. "dark" (DEFAULT_MODE)            — the final fallback
    With a hardcoded "dark" at step 2, the showcase label lied and the FIRST
    toggleMode() no-opped against the applied render; reading the APPLIED
    data-mode fixes both. Guards localStorage/document absence (never throws). */
export function getMode(): Mode {
  const m = read(MODE_KEY);
  if (isMode(m)) return m;
  const applied = appliedMode();
  if (applied) return applied;
  const legacy = read(THEME_KEY);
  if (isMode(legacy)) return legacy;
  return DEFAULT_MODE;
}

/** O(1): write html[data-theme], persist amu-theme, fire listeners. Nothing else
    (no component DOM scan, no style mutation, no re-mount). Accepts ANY
    registered theme name. */
export function setTheme(name: ThemeName): void {
  try {
    document.documentElement.dataset.theme = name;
  } catch {
    /* no document (e.g. a worker) — persistence still happens below */
  }
  try {
    localStorage.setItem(THEME_KEY, name);
  } catch {
    /* quota / private mode — the attribute is set regardless */
  }
  const mode = getMode();
  for (const fn of listeners) fn(name, mode);
}

/** O(1): write html[data-mode], persist amu-mode, fire listeners. Nothing else. */
export function setMode(mode: Mode): void {
  try {
    document.documentElement.dataset.mode = mode;
  } catch {
    /* no document — persistence still happens below */
  }
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* quota / private mode — the attribute is set regardless */
  }
  const theme = getTheme();
  for (const fn of listeners) fn(theme, mode);
}

/** O(1): flip the mode (dark↔light) via setMode. */
export function toggleMode(): void {
  setMode(getMode() === "dark" ? "light" : "dark");
}

/** Subscribe to theme/mode changes; fn receives BOTH axes on every change.
    Returns an unsubscribe. */
export function onThemeChange(fn: (theme: ThemeName, mode: Mode) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The inline <head> script SOURCE: reads amu-theme + amu-mode (WITH the legacy
    "dark"/"light" → mode migration of AC-5) and sets BOTH data-theme + data-mode
    before first paint to prevent a flash of the default theme. When NO mode is
    persisted (and no legacy value), it falls back to DEFAULT_MODE ("dark") — the
    SAME chain getMode() resolves — so the data-mode prePaint applies always
    equals getMode() (CMT_7f57fd6a: prePaint and getMode resolve identically).
    Self-contained (no imports), try/catch-wrapped (FOUC-safe); a host embeds this
    verbatim inside a <script> in <head>. */
export const prePaintSnippet: string = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var m=localStorage.getItem("${MODE_KEY}");var d=document.documentElement;var isMode=function(v){return v==="dark"||v==="light";};if(!isMode(m)){m=isMode(t)?t:"${DEFAULT_MODE}";}var theme=(t&&!isMode(t))?t:"${DEFAULT_THEME}";d.setAttribute("data-theme",theme);d.setAttribute("data-mode",m);}catch(e){}})();`;
