# Architecture

The *why* behind the shape. [DEPENDENCY-MAP](../DEPENDENCY-MAP.md) is the
one-screen graph; this is the reasoning, the contracts, and the seams you build
against. Every claim here is anchored to a file under `src/`.

## Contents

1. [The layer graph](#1--the-layer-graph)
2. [The Mount contract (the one shape)](#2--the-mount-contract-the-one-shape)
3. [The handle lifecycle: update + destroy](#3--the-handle-lifecycle-update--destroy)
4. [The seams](#4--the-seams)
5. [The registries](#5--the-registries)
6. [Data flow through a DATA component](#6--data-flow-through-a-data-component)
7. [The rules the layering buys](#7--the-rules-the-layering-buys)

---

## 1 · The layer graph

```
            kernel                     theme platform
    (dom · format · events ·      (base.css + themes/*.css · theme.ts)
     responsive)                         │
              └───────────┬──────────────┘
                          ▼
                       contract
        (mount · service · page-spec · route · theme · index + toMount)
                          │
              ┌───────────┼───────────────┐
              ▼           ▼               ▼
          registry    components     page-assembly · router
     (component ·   (LEAF · COMPOSED ·
      type · pref)   DATA)
```

Each layer imports only from the layers above it. There are **no cycles and no
upward imports** — the kernel knows nothing of components, the contract knows
nothing of any concrete service, and a component depends on the contract, never
the reverse. Two deliberate design choices fall out of this:

- **`kernel/events.ts` never imports a `Service`** (a recursion guard: the error
  channel must not depend on the transport it reports errors about). The consumer
  reads `pendingEvents()` and ships them with its own transport.
- **The `engine/` is a leaf of the graph** — optional, injected-wasm-path, and
  nothing depends on it. Delete it and the framework still stands.

The kernel is four small modules: `dom` (the `el`/`esc`/`qs` builder — see
[AUTHORING](./AUTHORING.md#the-el-helper)), `format` (`initials`/`fmtDateTime`),
`events` (error capture), and `responsive` (device-class + breakpoint signals via
`matchMedia`). The theme platform is `base.css` (theme-agnostic structure) +
`themes/*.css` (the per-theme palette) + `theme.ts` (the two-axis seam); it
imports nothing (see [THEME](../THEME.md)).

---

## 2 · The Mount contract (the one shape)

Everything composable is a **`Mount`** that returns a **`MountHandle`**. This is
the single most important contract in the framework; get it right and the rest is
mechanical. It lives in [`src/contract/mount.ts`](../src/contract/mount.ts).

### The handle

```ts
export interface MountHandle<U = unknown> {
  el: HTMLElement;
  update?(partial: U): void;
  destroy?(): void;
}
```

`el` is the root node the component owns. `update` patches it from a partial
config; `destroy` tears it down. Both are optional and use **method syntax**
(not arrow-property syntax) on purpose — that makes them checked *bivariantly*,
so a concrete `update(partial: {title})` still satisfies a `MountHandle` typed
with the default `U = unknown`. That's what lets the registry, `page-assembly`,
and `router` treat every component uniformly without knowing its config shape.

### The canonical Mount type

```ts
export type Mount<Config = unknown, U = unknown> = (
  host: Element,
  ctx: MountCtx,
  config?: Config,
) => MountHandle<U>;

export interface MountCtx {
  service?: Service;   // the data seam; leaf components ignore it
  session?: unknown;   // opaque to amenan-ui; guards/consumers type it
  signal?: AbortSignal; // teardown propagation
}
```

This 3-arg shape — `(host, ctx, config?)` — is what the composition layer
consumes: `SurfaceSpec.mount`, `RailSpec.mount`, `PageSpec.topbar.mount`, and the
router's `mount` are all typed `Mount`. `page-assembly` calls them
`mount(host, ctx, config)` (see
[`page-assembly.ts:56`](../src/page-assembly.ts#L56)).

### The two authoring tiers — and why they don't clash

Here's the nuance that trips people. **Real components are authored with an
ergonomic 2-arg signature**, not the canonical 3-arg one:

```ts
// Every leaf/composed component looks like this — host + cfg, no ctx:
export function mountSelect(host: Element, cfg: SelectCfg): MountHandle<SelectUpdate> { … }
export function mountSurface(host: Element, cfg: SurfaceCfg): SurfaceHandle { … }
```

A leaf component doesn't need `ctx` (no service, no session), so threading it
through every call would be noise. The 2-arg form is the day-to-day authoring
tier. The 3-arg `Mount` is the *composition* tier — the uniform shape the
registry/page-assembly/router hold.

You **bridge the two tiers explicitly** at the composition boundary. Two tools:

1. **`toMount(factory)`** — wraps a leaf *factory* `(config?) => Node | MountHandle`
   into a uniform `Mount`. It appends the produced node to the host and hands back
   a handle whose `destroy()` removes it (or delegates to the factory's own
   handle). Use it for the many atoms that return a raw element.

2. **A hand-written adapter** — for a page-region component you compose into a
   `PageSpec`, write a thin `Mount` that maps `(slot, ctx, cfg)` onto the 2-arg
   call. This is exactly what the proof app does (see
   [`app.ts:39`](../src/app.ts#L39)):

   ```ts
   const surfaceMount: Mount<SurfaceSpec> = (slot, _ctx, cfg) =>
     mountSurface(slot, {
       ...(cfg?.title !== undefined ? { title: cfg.title } : {}),
       ...(cfg?.meta  !== undefined ? { meta:  cfg.meta  } : {}),
       head: cfg?.head !== false,
     });
   ```

> **Gotcha.** Passing a 2-arg `mountSurface` *directly* as a `PageSpec`'s
> `surface.mount` will typecheck (all of `SurfaceCfg`'s fields are optional, so
> `MountCtx` is structurally assignable to it) but misbehave at runtime — the
> composer calls `mount(host, ctx, cfg)`, so the component's 2nd positional arg
> binds to `ctx`, not your config. Always write the adapter (or `toMount`) at the
> `PageSpec` boundary. The README's one-liner is illustrative; `app.ts` is the
> real pattern.

---

## 3 · The handle lifecycle: update + destroy

**`update(partial)`** is how a live component takes new data without a re-mount —
`select.update({ value })`, `redtable.update({ rows })`. Components keep their
state in a **closure, never on the DOM** (no `data-*` round-trips): `mountSelect`
holds nothing but the `<select>` node and re-renders from the partial. Some
components widen the handle with domain methods — `surface.section(key)`,
`redtable.selection()`, `sidePanel.setOpen(open)` — but the base three are always
there (or intentionally absent, as with the `openModal` factory that returns
`{ el, close }`).

**`destroy()`** is guaranteed to run at end-of-life and must leave nothing behind:
remove the element, unsubscribe every listener (an `onThemeChange` teardown, a
`window` resize handler), clear timers, abort in-flight requests. `page-assembly`
proves the contract — it records handles in **mount order** and destroys them in
**reverse**, and a throwing child `destroy()` is swallowed so the cascade always
completes and the shell is removed (see
[`page-assembly.ts:81`](../src/page-assembly.ts#L81) and the AC-F3 tests in
[`tests/page-assembly.test.ts`](../tests/page-assembly.test.ts)).

Two components deliberately register **document-level** listeners that outlive a
single `destroy()` (a shared, module-level delegation bound once for the app's
life): `menu` (one delegated `click`/`keydown` for every trigger) and `omni`
(the global Ctrl/Cmd-K focus). That's a conscious trade — one listener instead of
N — and it's called out per-component in [COMPONENTS](./COMPONENTS.md).

---

## 4 · The seams

A *seam* is where the framework stops and your app plugs in. amenan-ui hardwires
no transport, no route, and no look — each is an injection point. There are four.

### Service — the data seam

[`src/contract/service.ts`](../src/contract/service.ts):

```ts
export interface Service {
  get<T>(path: string, opts?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  upload<T>(path: string, file: File | FormData): Promise<T>;
}
export type Source<T> = (query?: Record<string, unknown>) => Promise<T>;
export interface ServiceError extends Error { status: number; body?: unknown; }
```

A fetch-shaped CRUD surface with **no base path and no 401→login bounce** — those
are your concern. You set `ctx.service = <your api>` and handle auth in a Guard.
A component that only reads takes a narrower **`Source<T>`** (`(query?) =>
Promise<T>`) instead of the whole `Service` — `omni` takes a
`Source<OmniResult[]>`, `message-thread` a `Source<Message[]>`. This is the whole
point of the DATA tier: the coupling is a callback you pass, never a route the
library knows.

### PageSpec — the page seam

[`src/contract/page-spec.ts`](../src/contract/page-spec.ts). A pure, declarative
description of a page: a `surface` (always), an optional injected `topbar`, and an
optional `rail` driven by literal `groups` data plus an optional injected `load`.
No fetch, no session heuristic — region presence is explicit: topbar iff
`spec.topbar`, rail iff `spec.rail`, surface always. `assemblePage(host, spec,
ctx)` composes it and returns section hosts you mount data components into.

### RouteMap + Guard — the routing seam

[`src/contract/route.ts`](../src/contract/route.ts) + `src/router.ts`.
`createRouter(cfg)` drives a generic `RouteMap` over the hash. Auth/admin/login
gates are consumer **`Guard`s**, not built in — a guard that returns a route id
redirects and aborts. Module loading is your `mount` (plus an optional injected
`loadModule`). The framework ships no nav literal.

### Theme — the look seam

[`src/theme/theme.ts`](../src/theme/theme.ts) + the `--*` token contract. The
swappable schema is the token *names*; a theme is a `name × mode` pair keyed on
`html[data-theme]` × `html[data-mode]`. `setTheme`/`setMode`/`toggleMode` are
each O(1): one attribute write + one `localStorage` mirror + fire listeners. The
full contract, the two-axis selector, and the add-a-theme recipe are in
[THEME](../THEME.md); the O(1) mechanism and its backlog are in
[O1-KNOBS](./O1-KNOBS.md).

---

## 5 · The registries

Three small stores under [`src/registry/`](../src/registry/), each a seam of its
own. They import the contract and **never a concrete service**.

- **component-registry** — a typed `Map<string, Component>` (`register` /
  `getComponent` / `listComponents`). A `Component` is `{ name, mount, meta? }`,
  so anything registered is already the uniform `Mount` shape.
- **type-registry** — the object catalogue (`getTypes` / `getType` /
  `invalidate`) read over the `Service` seam. It's what lets `object-list` derive
  a table's columns from a `TypeDef` with zero per-type code.
- **pref-registry** — the behavior registry: `registerPref` / `registerPolicy` /
  `getPref` / `setPref` over an injected persistence sink (`configurePersistence`),
  plus **`applyDocumentPref(key, value)`** — the bridge from a stored preference
  to a `html[data-*]` attribute. This is the mechanism `settings-form` renders and
  the one [O1-KNOBS](./O1-KNOBS.md) extends. A preference registered anywhere
  shows up in the settings form with no page edits — the "third framework."

---

## 6 · Data flow through a DATA component

A DATA component never fetches. It reaches data only through the seam it's handed,
and it paints **optimistically**, reverting on failure. The canonical loop
(`object-list`, `message-thread`, `perm-cell` all follow it):

```
consumer wires ctx.service / a Source / an onAction callback
        │
        ▼
DATA component reads rows via its injected source(query)
        │  renders through the LEAF/COMPOSED tier it composes
        ▼
user acts → component paints the new state immediately
        │  and calls onChange(next) / onAction({kind,…})
        ▼
consumer persists → on reject, component reverts via update({ … })
```

`perm-cell` is the tiny reference: it holds no matrix, fetches nothing, cycles a
tier on click, reports `onChange(next)`, and if the write fails the consumer calls
`update({ value })` to revert. `object-list` is the large one: columns from the
type-registry, rows from `cfg.source(type)`, writes through
`cfg.onAction({ kind, type, rid?, data? })` — a whole CRUD table with no route
literal anywhere in the library.

---

## 7 · The rules the layering buys

The graph isn't decoration — it's enforced, and each edge buys a guarantee:

- **No upward imports** → you can lift any layer out standalone. The kernel, the
  theme platform, and the contract are each independently reusable.
- **Contract never imports a concrete service** → the UI is transport-agnostic by
  construction; there is no base path or endpoint to grep for in the library.
- **One component owns its `.amu-<name>*` namespace** → styling is local and
  forkless; another component that wants the look *composes* the component, it
  doesn't restyle the class. CI enforces this (see [DISCIPLINE](../DISCIPLINE.md)).
- **`styles.css` is the single `@import` manifest** → manifest order = cascade
  order, and the build flattens it byte-faithfully into `dist/tokens.css`. No
  component injects a `<style>` tag.

Extending any of this is [AUTHORING](./AUTHORING.md); consuming it is
[GETTING-STARTED](./GETTING-STARTED.md).
