/* theme.ts — the theme seam. amenan-ui ships a two-theme palette (dark default +
   light) keyed on `html[data-theme]`; this module is the only runtime that
   reads/writes the choice. No service, no framework: just the document attribute
   + a localStorage mirror under the `amu-theme` key.

   `prePaintSnippet` is the inline <head> script SOURCE a host embeds before
   first paint so the persisted theme is applied with zero FOUC. */

export type ThemeName = "dark" | "light";

/** The localStorage key the choice persists under. */
export const THEME_KEY = "amu-theme";

/** The fallback when nothing is persisted (matches the :root default). */
const DEFAULT_THEME: ThemeName = "dark";

const listeners = new Set<(name: ThemeName) => void>();

function isThemeName(v: unknown): v is ThemeName {
  return v === "dark" || v === "light";
}

/** Read the persisted theme → default `dark`. Tolerant of no-localStorage. */
export function getTheme(): ThemeName {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (isThemeName(v)) return v;
  } catch {
    /* private mode / no storage — fall through to the default */
  }
  return DEFAULT_THEME;
}

/** Set `html[data-theme]`, persist under `amu-theme`, and notify listeners. */
export function applyTheme(name: ThemeName): void {
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
  for (const fn of listeners) fn(name);
}

/** Subscribe to theme changes; returns an unsubscribe. */
export function onThemeChange(fn: (name: ThemeName) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The inline <head> script SOURCE: reads `amu-theme` and sets `data-theme`
    before first paint to prevent a flash of the default theme. A host embeds
    this verbatim inside a <script> in <head>. Self-contained (no imports). */
export const prePaintSnippet: string = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
