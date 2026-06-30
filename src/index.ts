/* index.ts — the public barrel. Re-exports the foundation (kernel + contract +
   theme + registries + page-assembly + router). Components are added by later
   waves; this file grows with them. */

// Kernel.
export { esc, el, qs } from "./kernel/dom.ts";
export type { Attrs, Child } from "./kernel/dom.ts";
export { initials, fmtDateTime } from "./kernel/format.ts";
export {
  installErrorCapture,
  captureMountError,
  pendingEvents,
} from "./kernel/events.ts";
export type { CapturedEvent } from "./kernel/events.ts";

// Contract (the load-bearing public types + toMount adapter).
export type {
  MountCtx,
  MountHandle,
  Mount,
  Component,
  ServiceError,
  Service,
  Source,
  SectionSpec,
  RailGroup,
  RailSpec,
  ActionSpec,
  SurfaceSpec,
  PageSpec,
  RouteDef,
  RouteMap,
  RouteCtx,
  Guard,
  Router,
} from "./contract/index.ts";
export { toMount } from "./contract/index.ts";

// Theme.
export type { ThemeName } from "./theme/theme.ts";
export { applyTheme, getTheme, onThemeChange, THEME_KEY, prePaintSnippet } from "./theme/theme.ts";

// Registries.
export { register, getComponent, listComponents } from "./registry/component-registry.ts";
export { getTypes, getType, invalidate } from "./registry/type-registry.ts";
export type { TypeDef, TypeField } from "./registry/type-registry.ts";
export {
  configurePersistence,
  registerPref,
  registerPolicy,
  seedResolved,
  getPref,
  setPref,
  setPolicy,
  applyDocumentPref,
  listPrefs,
  listPolicies,
  onPrefChange,
} from "./registry/pref-registry.ts";
export type { PrefDef, PrefControl, Persist } from "./registry/pref-registry.ts";

// Page assembly + router.
export { assemblePage } from "./page-assembly.ts";
export type { PageHandle } from "./page-assembly.ts";
export { createRouter } from "./router.ts";
export type { RouterConfig } from "./router.ts";
