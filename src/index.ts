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

// Components — W3a leaf tier (atoms first; others compose it).
export * from "./components/atoms/atoms.ts";
export * from "./components/card/card.ts";
export * from "./components/empty-state/empty-state.ts";
export * from "./components/modal/modal.ts";
export * from "./components/menu/menu.ts";
export * from "./components/select/select.ts";
export * from "./components/toast/toast.ts";
export * from "./components/stat/stat.ts";
export * from "./components/field/field.ts";
export * from "./components/chip-row/chip-row.ts";

// Components — W3b leaf tier (compose the W3a atoms/menu/select/field above).
export * from "./components/pager/pager.ts";
export * from "./components/surface/surface.ts";
export * from "./components/markdown/markdown.ts";
export * from "./components/uploader/uploader.ts";
export * from "./components/score-badge/score-badge.ts";
export * from "./components/side-panel/side-panel.ts";
export * from "./components/dashboard-grid/dashboard-grid.ts";
export * from "./components/grid-toolbar/grid-toolbar.ts";
export * from "./components/report-builder/report-builder.ts";
export * from "./components/settings-form/settings-form.ts";

// Components — W4a composed/layout tier (token reads, no service).
// chart: the tile + its build/render/theme helpers (ECharts via window.echarts,
// graceful no-op when absent).
export * from "./components/chart/chart.ts";
export * from "./components/chart/build.ts";
export * from "./components/chart/render.ts";
export * from "./components/chart/theme.ts";
// filter-panel: the builder + the pure filter-node algebra.
export * from "./components/filter-panel/filter-panel.ts";
export * from "./components/filter-panel/filter-node.ts";
export * from "./components/column-manager/column-manager.ts";
export * from "./components/joins-wizard/joins-wizard.ts";
export * from "./components/sql-editor/sql-editor.ts";
export * from "./components/steps-panel/steps-panel.ts";
export * from "./components/workspace-panels/workspace-panels.ts";
