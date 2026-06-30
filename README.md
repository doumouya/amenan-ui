# amenan-ui

A standalone, **dependency-free**, theme-agnostic vanilla-TypeScript UI
framework: a tiny `dom` builder, three registries (component / type / behavior),
a declarative `page-assembly`, a generic hash `router`, and a component library —
with one CI-enforced single-CSS-ownership discipline.

No runtime dependencies. No framework. Strict TypeScript. The JS↔data boundary
is a single injectable `Service` seam; the UI never hardwires a transport.

## Install

```sh
npm install amenan-ui
```

amenan-ui ships **zero runtime dependencies** (`package.json` has no
`dependencies`). Its only dev dependencies are `typescript`, `esbuild`, and
`@types/node` (for the test harness). Vendored static assets under `vendor/`
(Bootstrap Icons, ECharts) are NOT npm dependencies — link them only if you use
icon glyphs or charts.

## Linking the tokens

The package owns a `--*` design-token vocabulary and two themes (dark default +
light). Link the flattened stylesheet:

```html
<link rel="stylesheet" href="amenan-ui/tokens.css" />
```

In this repo's dev mode, link `styles.css` (the `@import` manifest). See
[`THEME.md`](./THEME.md) for the token table and the `data-theme` contract, and
embed the pre-paint snippet (`prePaintSnippet`) in `<head>` to avoid a flash of
the default theme.

## Composing a page — `assemblePage`

`assemblePage(host, spec, ctx)` builds a whole page from a pure `PageSpec`: a
surface (always), plus an optional injected topbar and an optional rail driven by
literal `groups` data. No fetch, no hardwired nav.

```ts
import { assemblePage } from "amenan-ui";

const page = assemblePage(document.querySelector("#app")!, {
  surface: {
    mount: mountSurface, // any Mount
    title: "Reports",
    sections: [{ key: "main" }],
  },
}, { /* MountCtx: optional service / session / signal */ });

const main = page.section("main"); // mount data components here
// page.destroy(); // tears down every region in reverse mount order
```

## Routing — `createRouter`

`createRouter(cfg)` drives a generic `RouteMap`. Auth/admin/login gates are
consumer **Guards** (not built in); a guard returning a route id redirects and
aborts. Module loading is the consumer's `mount` (+ an optional injected
`loadModule`).

```ts
import { createRouter } from "amenan-ui";

const router = createRouter({
  routes: { home: {}, reports: {} },
  mount: (host, def, ctx) => mountPage(host, def, ctx),
  resolveLanding: () => "home",
  guards: [(id, ctx) => (ctx.session ? null : "login")],
});
router.start();
```

## Components

| Tier | Components |
|---|---|
| LEAF | atoms (button, chip, input, textarea, badge, spinner, kbd), card, empty-state, modal, menu, select, toast, stat, field, chip-row, pager, surface, markdown, uploader, score-badge, side-panel, dashboard-grid, grid-toolbar, report-builder, settings-form |
| COMPOSED | chart, filter-panel, grid-view, redtable, column-manager, joins-wizard, sql-editor, steps-panel, workspace-panels, topbar, rail |
| DATA | rail-data, object-list, message-thread, omni, chart-editor, perm-cell |

All 36 components ship, plus the foundation (kernel, contract, theme, registries,
page-assembly, router) and the optional, injected-wasm-path engine (wasm-engine +
window-source). LEAF components are pure DOM; COMPOSED read theme tokens only;
DATA components decouple every backend coupling behind an injected
`source`/`send`/`onAction` callback (the Service/Source seam) — no transport,
no fetch, no route literal anywhere in the library.

## Theme toggle

`theme.ts` is the only runtime that reads/writes the choice:

```ts
import { applyTheme, getTheme, onThemeChange } from "amenan-ui";

applyTheme(getTheme() === "dark" ? "light" : "dark"); // toggle + persist
onThemeChange((name) => console.log("theme is now", name));
```

The choice persists under `localStorage["amu-theme"]`; embed `prePaintSnippet` in
`<head>` so the persisted theme is applied before first paint (no FOUC).

## Proof — showcase + app

Two entries prove the library standalone, with zero network:

- **`src/showcase.ts`** → `dist/showcase.js` — a specimen gallery mounting EVERY
  component (data/RBAC ones fed in-memory MOCK sources via the seam), with a
  light/dark toggle. Host page: `index.html`. The chart specimens render a real
  ECharts tile when `vendor/echarts/echarts.min.js` is on the page (graceful
  empty placeholder otherwise); the engine specimen demos the clean no-wasm path.
- **`src/app.ts`** → `dist/app.js` — a standalone proof app: one `assemblePage`
  page (surface + a literal rail) wired to a 2-route `createRouter` (no guards).
  Host page: `app.html`.

Open `index.html` / `app.html` after `npm run build`. The vendored Bootstrap
Icons + ECharts under `vendor/` are static assets (NOT npm deps) — the showcase
links them so `bi-*` glyphs and charts render.

## The seams

- **Service** — the data seam. `interface Service { get/post/put/patch/del/upload }`.
  Wire `ctx.service = <your api>`; the UI never owns a base path or an auth bounce.
- **PageSpec** — the page seam. Pure data: a surface, an optional injected topbar,
  an optional rail (literal `groups` + an optional injected `load`).
- **RouteMap + Guard** — the routing seam. A generic map + a guard chain.
- **Theme** — the look seam. The `--*` token names are the swappable schema.

## Build + CI

```sh
npm run typecheck   # tsc --noEmit
npm run audit       # ui-fork-audit + scrub, ratcheted
npm run build       # flatten CSS → dist/tokens.css, emit dist/types, bundle
npm run test        # node --test
npm run ci          # the ordered gate: typecheck → audit → build → test
```

See [`DISCIPLINE.md`](./DISCIPLINE.md) for the audit rules and
[`DEPENDENCY-MAP.md`](./DEPENDENCY-MAP.md) for the layer graph.
