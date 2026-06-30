# Dependency map

The layer graph. Each layer imports only from layers above it — no cycles, no
upward imports. The kernel knows nothing of components; the contract knows
nothing of any concrete service; components depend on the contract, never the
reverse.

```
            kernel               theme platform
        (dom · format ·       (base.css + themes/*.css
         events · responsive)   · theme.ts)
              │                       │
              └───────────┬───────────┘
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
  `fmtDateTime`), `events` (error capture), `responsive` (device-class +
  breakpoint signals via matchMedia — `device`/`breakpoint`/`isTouch`/`isShort`/
  `isFolded`/`onChange` + `BREAKPOINTS`; its px values are the JS source of truth
  aligned to base.css's `--bp-*` rem tokens). Zero imports of anything else;
  `events` never imports a service (recursion guard).
- **theme platform** — `base.css` (the theme-agnostic STRUCTURE tier: spacing,
  radius, type scale, density, motion, breakpoints, z-index, shared `--font-mono`)
  + `themes/{redpash,portfolio,numu,_template}.css` (each fills the frozen `--*`
  token contract per theme × mode under `html[data-theme="<name>"][data-mode]`) +
  `theme.ts` (the open-ended two-axis seam: `setTheme`/`setMode`/`toggleMode`/
  `getTheme`/`getMode`/`listThemes`/`onThemeChange`/`prePaintSnippet`). `styles.css`
  is the single `@import` manifest (`base.css` then every theme, then components);
  the build flattens it into `dist/tokens.css`. `theme.ts` imports nothing.
- **contract** — the types every component conforms to: `Mount`/`MountHandle`/
  `MountCtx`, `Service`/`Source`, `PageSpec`/`RailSpec`/`SurfaceSpec`,
  `RouteMap`/`Guard`/`Router`, plus the `toMount` adapter. Imports only kernel +
  theme (for the re-exported types).
- **registry** — `component-registry` (a typed `Map<string, Component>`),
  `type-registry` (the object catalogue over the Service seam), `pref-registry`
  (the behavior registry over an injected persistence sink). Imports the
  contract; never imports a concrete service.
- **components** — each is `src/components/<name>/<name>.ts` (+ `<name>.css`),
  classified below. The W3 fold-in adds four web-kit ports
  (termbar / tabs / code / kindLabel), renamed to the `.amu-*` discipline with
  co-located sheets `@import`ed by `styles.css` (NOT injected `<style>` tags) and
  built on the kernel `el`; `perm-cell` also gains a `cap` ceiling.
- **page-assembly** + **router** — the composition layer: `assemblePage` builds a
  page from a `PageSpec`; `createRouter` drives a `RouteMap` with a guard chain.
  Both spec-driven and injection-fed — no fetch, no hardwired nav.
- **engine** (optional) — `wasm-engine` (the lazy loader behind an INJECTED wasm
  path) + `window-source` (a dual-source grid data layer behind the Service seam).
  Ships no wasm binary; with no path + no callbacks it degrades to empty/null (no
  throw, no log). Depends only on itself + the contract; nothing depends on it.

## Component classification

- **LEAF** — pure DOM, no domain, no service: atoms (button/chip/input/…), card,
  empty-state, modal, menu, select, toast, stat, field, chip-row, pager, surface,
  markdown, uploader, score-badge, side-panel, dashboard-grid, grid-toolbar,
  report-builder, settings-form, tabs, code, kindLabel.
- **COMPOSED** — layout/theme-only (reads tokens, no service): chart (+ theme
  palette), filter-panel (+ filter-node algebra), grid-view, redtable
  (+ virtual-rows + editor-registry), column-manager, joins-wizard, sql-editor,
  steps-panel, workspace-panels, topbar, rail, termbar (the Console strip — reads
  `theme.ts` mode + drives `toggleMode()`).
- **DATA** — service-coupled via the seam (`ctx.service` / injected `source` /
  `onAction` callbacks): rail-data, object-list, message-thread, omni,
  chart-editor, perm-cell.

A COMPOSED component imports the LEAF atoms it needs; it never re-implements one.
A DATA component reaches data only through the injected seam — never a hardwired
transport.

## Proof entries

`src/showcase.ts` and `src/app.ts` sit ABOVE every layer (they import the public
barrel `src/index.ts`) and are never imported by the library. `showcase.ts` mounts
every component (DATA ones fed in-memory MOCK sources via the seam); `app.ts`
builds one `assemblePage` page wired to a 2-route `createRouter`. The build bundles
them to `dist/showcase.js` / `dist/app.js`; `index.html` / `app.html` host them.
