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

// Components — W4b composed/layout tier (the 4 heaviest: the data table + its
// thin grid composer + the chrome frame).
// redtable: THE data table (virtual/pager modes) + virtual-rows windowing +
// the DEFAULT editor registry (editorFor injected as config, never hardwired).
export * from "./components/redtable/redtable.ts";
export * from "./components/redtable/virtual-rows.ts";
export * from "./components/redtable/editor-registry.ts";
// grid-view: thin composer (grid-toolbar + sheet slot + redtable).
export * from "./components/grid-view/grid-view.ts";
// topbar + rail: the chrome frame (decoupled from apps.js / fetch — injected nav
// config + onToggleRail callback; rail is UI-only, zero fetch).
export * from "./components/topbar/topbar.ts";
export * from "./components/rail/rail.ts";

// Components — W5a DATA / RBAC-coupled tier (decoupled via the Service seam —
// injected source/send/onChange callbacks; no boot/api, no fetch, no /api literal).
// perm-cell: the pure RBAC matrix cell (config-driven cycle order + onChange).
export * from "./components/perm-cell/perm-cell.ts";
// omni: global search via an injected Source<Result[]>; config-driven kinds.
export * from "./components/omni/omni.ts";
// message-thread: feed (injected poll source) + markdown composer (injected send).
export * from "./components/message-thread/message-thread.ts";
// chart-editor: chart-options form + live preview (injected columns/preview sources).
export * from "./components/chart-editor/chart-editor.ts";

// Components — W5b DATA-coupled tier (controller + generic CRUD body).
// rail-data: the CONTROLLER — wraps mountRail (W4b) + an injected loader/source
// + onAction/onRename/onNavigate/onTheme/onSignOut callbacks (no fetch, no /api,
// no location.hash hardwire). Reuses rail.css — declares NO new .amu-rail* class.
export * from "./components/rail/rail-data.ts";
// object-list: the generic object-table body — data via injected source, mutations
// via onAction, columns from the type-registry over the Service seam.
export * from "./components/object-list/object-list.ts";

// Engine — W5b optional, injected-wasm-path data engine (NO css). Lazy + graceful:
// with no wasm path + no service these degrade cleanly (no throw, no console error).
export * from "./engine/wasm-engine.ts";
export * from "./engine/window-source.ts";
