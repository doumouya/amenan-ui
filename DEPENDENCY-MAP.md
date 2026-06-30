# Dependency map

The layer graph. Each layer imports only from layers above it — no cycles, no
upward imports. The kernel knows nothing of components; the contract knows
nothing of any concrete service; components depend on the contract, never the
reverse.

```
            kernel            theme
        (dom · format ·   (tokens.css ·
            events)          theme.ts)
              │                  │
              └────────┬─────────┘
                       ▼
                   contract
        (mount · service · page-spec ·
         route · theme · index · toMount)
                       │
              ┌────────┼──────────────┐
              ▼        ▼              ▼
         registry  components    page-assembly
        (component· (LEAF ·         · router
         type · pref) COMPOSED ·
                       DATA)
```

- **kernel** — `dom` (the `el`/`esc`/`qs` builder), `format` (`initials`/
  `fmtDateTime`), `events` (error capture). Zero imports of anything else;
  `events` never imports a service (recursion guard).
- **theme** — `tokens.css` (the `--*` vocabulary) + `theme.ts` (the
  `applyTheme`/`getTheme`/`onThemeChange` seam). Imports nothing.
- **contract** — the types every component conforms to: `Mount`/`MountHandle`/
  `MountCtx`, `Service`/`Source`, `PageSpec`/`RailSpec`/`SurfaceSpec`,
  `RouteMap`/`Guard`/`Router`, plus the `toMount` adapter. Imports only kernel +
  theme (for the re-exported types).
- **registry** — `component-registry` (a typed `Map<string, Component>`),
  `type-registry` (the object catalogue over the Service seam), `pref-registry`
  (the behavior registry over an injected persistence sink). Imports the
  contract; never imports a concrete service.
- **components** — each is `src/components/<name>/<name>.ts` (+ `<name>.css`),
  classified below. (Added in waves W3–W5.)
- **page-assembly** + **router** — the composition layer: `assemblePage` builds a
  page from a `PageSpec`; `createRouter` drives a `RouteMap` with a guard chain.
  Both spec-driven and injection-fed — no fetch, no hardwired nav.

## Component classification

- **LEAF** — pure DOM, no domain, no service: atoms (button/chip/input/…), card,
  empty-state, modal, menu, select, toast, stat, field, chip-row, pager, surface,
  markdown, uploader, score-badge, side-panel, dashboard-grid, grid-toolbar,
  report-builder, settings-form.
- **COMPOSED** — layout/theme-only (reads tokens, no service): chart (+ theme
  palette), filter-panel (+ filter-node algebra), grid-view, redtable
  (+ virtual-rows + editor-registry), column-manager, joins-wizard, sql-editor,
  steps-panel, workspace-panels, topbar, rail.
- **DATA** — service-coupled via the seam (`ctx.service` / injected `source` /
  `onAction` callbacks): rail-data, object-list, message-thread, omni,
  chart-editor, perm-cell.

A COMPOSED component imports the LEAF atoms it needs; it never re-implements one.
A DATA component reaches data only through the injected seam — never a hardwired
transport.
