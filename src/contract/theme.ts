/* theme.ts (contract) — the theme seam's public type surface. The runtime lives
   in src/theme/theme.ts; this re-exports the union + the function signatures so a
   consumer can type against the contract barrel without reaching into src/theme. */

export type { ThemeName } from "../theme/theme.ts";
export { applyTheme, getTheme, onThemeChange } from "../theme/theme.ts";
