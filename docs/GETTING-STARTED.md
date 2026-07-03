# Getting started

From zero to a themed, routed page — the hands-on path. For the *why* behind any
step, follow the links into [ARCHITECTURE](./ARCHITECTURE.md); for a specific
component's config, [COMPONENTS](./COMPONENTS.md).

## Contents

1. [Install](#1--install)
2. [Link the tokens + kill FOUC](#2--link-the-tokens--kill-fouc)
3. [Mount your first component](#3--mount-your-first-component)
4. [Switch theme + mode](#4--switch-theme--mode)
5. [Compose a page](#5--compose-a-page)
6. [Add a router](#6--add-a-router)
7. [Wire the data seam](#7--wire-the-data-seam)
8. [Build + CI](#8--build--ci)

---

## 1 · Install

```sh
npm install amenan-ui
```

amenan-ui ships **zero runtime dependencies** — `package.json` has no
`dependencies` key; its only dev deps are `typescript`, `esbuild`, and
`@types/node`. Vendored assets under `vendor/` (Bootstrap Icons, ECharts) are
**not** npm deps: link them only if you use icon glyphs (`bi-*`) or the `chart`
component.

Everything is imported from the one barrel:

```ts
import { el, mountCard, setTheme, assemblePage, createRouter } from "amenan-ui";
```

---

## 2 · Link the tokens + kill FOUC

Two things belong in your `<head>`: the stylesheet (so `var(--token)` resolves)
and the pre-paint snippet (so the persisted theme is applied *before* first
paint, with no flash of the default look).

```html
<head>
  <!-- 1. Apply the persisted theme+mode BEFORE the stylesheet paints.
          Paste the value of `prePaintSnippet` here verbatim (see index.html). -->
  <script>
    (function(){try{var t=localStorage.getItem("amu-theme");var m=localStorage.getItem("amu-mode");
    var d=document.documentElement;var isMode=function(v){return v==="dark"||v==="light";};
    if(!isMode(m)){m=isMode(t)?t:"dark";}var theme=(t&&!isMode(t))?t:"redpash";
    d.setAttribute("data-theme",theme);d.setAttribute("data-mode",m);}catch(e){}})();
  </script>

  <!-- 2. The flattened token + component stylesheet. -->
  <link rel="stylesheet" href="amenan-ui/tokens.css" />
</head>
```

The snippet source is exported as `prePaintSnippet` — in a build step you can
read it and inline it rather than hand-copying. In this repo's dev mode, link
`styles.css` (the `@import` manifest) instead of `dist/tokens.css`; both carry the
same `--*` contract. Without the snippet everything still works — you just get a
one-frame flash of `redpash` + `dark` before the persisted look applies. See
[THEME](../THEME.md) for the two-axis model.

---

## 3 · Mount your first component

Every component is `mountX(host, cfg)` and returns a handle
(`{ el, update?, destroy? }` — see
[ARCHITECTURE §2](./ARCHITECTURE.md#2--the-mount-contract-the-one-shape)):

```ts
import { mountCard } from "amenan-ui";

const host = document.querySelector("#app")!;
const card = mountCard(host, {
  title: "Reports",
  sub: "Everything renders with zero network.",
});

// later — patch it live, or tear it down:
// card.destroy();
```

A few components are **factories**, not mounts — they build and place themselves
(and take no `host`): `openModal(cfg)`, `confirmModal(cfg)`, `toast(cfg)`, and the
`atoms` builders (`button(cfg)`, `input(cfg)`, …) which return a raw element you
append yourself. [COMPONENTS](./COMPONENTS.md) flags each one.

```ts
import { confirmModal, toast, button } from "amenan-ui";

host.append(button({ label: "Delete", variant: "danger", onClick: async () => {
  if (await confirmModal({ title: "Delete file?", danger: true })) {
    toast({ message: "Deleted" });
  }
}}));
```

---

## 4 · Switch theme + mode

The look is two axes — a theme **name** × a **mode** — and switching either is
one attribute write (O(1)):

```ts
import { setTheme, setMode, toggleMode, listThemes, onThemeChange } from "amenan-ui";

setTheme("portfolio");   // write html[data-theme], persist amu-theme
setMode("light");        // write html[data-mode], persist amu-mode
toggleMode();            // flip dark ↔ light
listThemes();            // ["redpash", "portfolio", "numu"] — cycle these

const off = onThemeChange((theme, mode) => console.log("look:", theme, mode));
// off();  // unsubscribe
```

Your components need to do nothing to react — they read `var(--token)` and the
CSS cascade re-resolves them. The sole exception is the `chart` component (canvas
can't observe CSS vars), which subscribes to `onThemeChange` internally. Full
mechanism: [O1-KNOBS](./O1-KNOBS.md).

---

## 5 · Compose a page

`assemblePage(host, spec, ctx)` builds a whole page from a pure `PageSpec` — a
surface (always), plus an optional topbar and rail. It hands back the section
hosts you mount content into, and one `destroy()` that tears down every region in
reverse order.

The key detail: a `PageSpec`'s `mount` fields want the canonical 3-arg `Mount`,
while components are authored 2-arg — so you write a thin **adapter** at the
boundary (see
[ARCHITECTURE §2](./ARCHITECTURE.md#the-two-authoring-tiers--and-why-they-dont-clash)).
This is the real, verified pattern from [`src/app.ts`](../src/app.ts):

```ts
import {
  assemblePage, mountSurface, mountStatStrip, mountCard,
} from "amenan-ui";
import type { Mount, MountCtx, SurfaceSpec } from "amenan-ui";

// Adapt the 2-arg component to the 3-arg Mount the PageSpec expects.
const surfaceMount: Mount<SurfaceSpec> = (slot, _ctx, cfg) =>
  mountSurface(slot, {
    ...(cfg?.title !== undefined ? { title: cfg.title } : {}),
    ...(cfg?.meta  !== undefined ? { meta:  cfg.meta  } : {}),
    head: cfg?.head !== false,
  });

const page = assemblePage(document.querySelector("#app")!, {
  surface: {
    mount: surfaceMount,
    title: "amenan-ui",
    meta: "standalone",
    sections: [{ key: "main", layout: "fill" }],
  },
}, { /* MountCtx: optional service / session / signal */ } as MountCtx);

// Mount your content into a named section host:
const main = page.section("main");
if (main) {
  mountStatStrip(main, { stats: [{ label: "Files", value: 42, tone: "ok" }] });
  mountCard(main, { title: "Welcome", sub: "Zero backend." });
}

// page.destroy();  // reverse-order teardown of every region
```

Add a `rail` or `topbar` to the spec the same way (each with its own adapter);
they mount only when present. `app.ts` shows a literal rail wired to the router
below.

---

## 6 · Add a router

`createRouter(cfg)` drives a generic hash `RouteMap`. Guards are yours (not built
in) — a guard that returns a route id redirects. Here the router re-paints one
surface section on each navigation (the [`app.ts`](../src/app.ts) shape):

```ts
import { createRouter } from "amenan-ui";
import type { RouteMap, MountHandle } from "amenan-ui";

const routes: RouteMap = {
  overview: { meta: { id: "overview" } },
  files:    { meta: { id: "files" } },
};

const router = createRouter({
  routes,
  resolveLanding: () => "overview",
  // Optional auth gate — return a route id to redirect, or null to allow:
  guards: [(id, ctx) => (ctx.session ? null : "overview")],
  mount: (_host, def): MountHandle => {
    const id = def.meta?.["id"] as string;
    if (main) { main.replaceChildren(); paint(id, main); }
    return { el: main!, destroy: () => main?.replaceChildren() };
  },
});

router.start();
```

Build the page shell **once** with `assemblePage`; let the router re-paint the
section. No guard, no server rail fetch, no login bounce is required — `app.ts`
proves the whole thing composes with zero backend couplings.

---

## 7 · Wire the data seam

DATA-tier components (`object-list`, `omni`, `message-thread`, …) never fetch —
you hand them a `Service` (or a narrower `Source<T>`) and they read through it,
painting optimistically and reverting on failure
([ARCHITECTURE §6](./ARCHITECTURE.md#6--data-flow-through-a-data-component)):

```ts
import type { Service } from "amenan-ui";

const service: Service = {
  get:   (p)      => fetch(base + p).then(r => r.json()),
  post:  (p, b)   => fetch(base + p, { method: "POST", body: JSON.stringify(b) }).then(r => r.json()),
  put:   (p, b)   => fetch(base + p, { method: "PUT",  body: JSON.stringify(b) }).then(r => r.json()),
  patch: (p, b)   => fetch(base + p, { method: "PATCH", body: JSON.stringify(b) }).then(r => r.json()),
  del:   (p)      => fetch(base + p, { method: "DELETE" }).then(r => r.json()),
  upload:(p, f)   => fetch(base + p, { method: "POST", body: f }).then(r => r.json()),
};

// pass it as ctx.service to assemblePage / the router, or feed a component a Source:
mountOmni(host, { source: ({ q, limit }) => service.get(`/search?q=${q}&limit=${limit}`) });
```

The library owns no base path and no auth bounce — put those in your `Service`
impl and in a `Guard`.

---

## 8 · Build + CI

```sh
npm run typecheck   # tsc --noEmit (strict)
npm run audit       # single-CSS-ownership audit + scrub, ratcheted
npm run build       # flatten CSS → dist/tokens.css, emit dist/types, bundle
npm run test        # node --test
npm run ci          # the ordered gate: typecheck → audit → build → test
```

`npm run ci` is the one gate (exit code = failed-stage count; 0 = clean). The
build flattens the `styles.css` `@import` manifest byte-faithfully into
`dist/tokens.css`, emits the `.d.ts` type tree, and bundles the two proof entries
(`showcase.ts`, `app.ts`). The audit rules are in [DISCIPLINE](../DISCIPLINE.md);
adding your own component is [AUTHORING](./AUTHORING.md).
