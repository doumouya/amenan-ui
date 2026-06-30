/* contract/index.ts — the one barrel for every amenan-ui contract type. The
   load-bearing public surface: a consumer imports Mount / MountHandle / Service /
   PageSpec / RouteMap / etc. from here, and the contract test proves the seams
   compose (tsc IS the assertion). */

// Mount contract (+ the toMount adapter, a value).
export type { Attrs, Child, MountCtx, MountHandle, Mount, Component } from "./mount.ts";
export { toMount } from "./mount.ts";

// Data seam.
export type { ServiceError, Service, Source } from "./service.ts";

// Page spec.
export type {
  SectionSpec,
  RailGroup,
  RailSpec,
  ActionSpec,
  SurfaceSpec,
  PageSpec,
} from "./page-spec.ts";

// Route map + guards.
export type { RouteDef, RouteMap, RouteCtx, Guard, Router } from "./route.ts";

// Theme seam (types + functions).
export type { ThemeName } from "./theme.ts";
export { applyTheme, getTheme, onThemeChange } from "./theme.ts";
