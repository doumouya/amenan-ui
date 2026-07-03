# Authoring

Extending the framework, not just consuming it — adding a component, a theme, or
an O(1) preference knob. The shape you're conforming to is
[ARCHITECTURE §2](./ARCHITECTURE.md#2--the-mount-contract-the-one-shape); the CSS
rules the audit enforces are [DISCIPLINE](../DISCIPLINE.md).

## Contents

1. [The `el` helper](#1--the-el-helper)
2. [Anatomy of a component](#2--anatomy-of-a-component)
3. [The authoring checklist](#3--the-authoring-checklist)
4. [The destroy contract](#4--the-destroy-contract)
5. [Token-only CSS](#5--token-only-css)
6. [Add a theme](#6--add-a-theme)
7. [Add an O(1) preference knob](#7--add-an-o1-preference-knob)

---

## 1 · The `el` helper

Every component builds its DOM with `el` from
[`src/kernel/dom.ts`](../src/kernel/dom.ts) — a tiny typed factory, no framework,
no JSX:

```ts
el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs?: Attrs, ...children: Child[]
): HTMLElementTagNameMap[K]
```

`el("button", …)` infers `HTMLButtonElement`. The attr bag has exactly three
rules:

- `class` → `className`.
- `on<event>` + a **function** → `addEventListener(<event>, fn)`.
- everything else → `setAttribute(k, String(v))`. **Nullish attrs are skipped** —
  so `{ href: cfg.href ?? null }` cleanly omits an absent attribute.

Children are flattened one level; a `Node` is appended as-is, a primitive becomes a
text node (so interpolated strings are auto-escaped — never build markup by string
concatenation). `esc(v)` HTML-escapes a value if you ever need it; `qs(root, sel)`
is a typed scoped `querySelector`.

```ts
import { el } from "../../kernel/dom.ts";

const card = el("div", { class: "amu-card" },
  el("h3", { class: "amu-card-title" }, cfg.title ?? ""),
  cfg.sub ? el("p", { class: "amu-card-sub" }, cfg.sub) : null,   // null child → skipped
);
```

### Two gotchas worth internalizing

**Event keys are lowercase.** The listener registers on the string *after* `on`,
verbatim: `onclick` → `click`. Writing `onClick` registers a `"Click"` listener
that never fires. Use `onclick`, `oninput`, `onchange`, `onkeydown`, ….

**Set stateful properties on the node, not via `el`.** Because non-`class`/`on*`
attrs go through `setAttribute`, a boolean DOM property like `checked`/`selected`
must be set on the element *after* creation — an attribute `checked="true"` sets
the element's *default* checked state, and any non-null value counts as present, so
you can't uncheck through `el`. Build structure with `el`, then assign the live
property directly (this is what [`select.ts`](../src/components/select/select.ts)
does):

```ts
const opt = el("option", { value: o.value }, o.label);
if (o.value === value) opt.selected = true;   // property, not setAttribute
// likewise:  input.checked = …,  input.value = …,  button.disabled = …
```

---

## 2 · Anatomy of a component

One component = one directory = one CSS namespace:

```
src/components/<name>/
├── <name>.ts     // exports mount<Name> + its Cfg/Update/Handle interfaces
└── <name>.css    // sole owner of .amu-<name>* — no other selector
```

The `.ts` exports, by convention:

```ts
export interface <Name>Cfg { /* required + optional config */ }
export interface <Name>Update { /* the partial update() accepts */ }   // if update() is used
export interface <Name>Handle extends MountHandle<<Name>Update> {       // only if you add methods
  /* extra methods beyond el/update/destroy */
}

export function mount<Name>(host: Element, cfg: <Name>Cfg): <Name>Handle {
  const root = el("div", { class: "amu-<name>" });
  // …build, wire listeners, compose LEAF atoms you need…
  host.append(root);
  return {
    el: root,
    update: (p) => { /* re-render from the partial */ },
    destroy: () => { /* remove + unsubscribe — see §4 */ },
  };
}
```

Author in the **2-arg `mountX(host, cfg)`** form (the ergonomic tier). If a
consumer needs to drop your component into a `PageSpec`, they wrap it in a 3-arg
`Mount` adapter or `toMount` at that boundary — you don't take `ctx` unless you
genuinely read `ctx.service`/`ctx.session`/`ctx.signal`
([ARCHITECTURE §2](./ARCHITECTURE.md#the-two-authoring-tiers--and-why-they-dont-clash)).
Compose the LEAF atoms you need (`button`, `input`, `mountSelect`, `mountField`);
never re-implement one, and never restyle another component's `.amu-*` class.

---

## 3 · The authoring checklist

**Structure**
- [ ] `src/components/<name>/<name>.ts` — `mount<Name>` + exported `Cfg`/`Update`/`Handle`.
- [ ] `src/components/<name>/<name>.css` — header comment
      `/* <name> — description. Sole owner of .amu-<name>*. */`, only `.amu-<name>*`
      selectors, only token vars (§5).

**Wire it in** (two manifests, both required)
- [ ] `src/index.ts` — `export * from "./components/<name>/<name>.ts";` in the
      appropriate tier block.
- [ ] `styles.css` — `@import "src/components/<name>/<name>.css";` after the theme
      sheets (manifest order = cascade order; the audit's R6 checks this).

**Functionality**
- [ ] `mount<Name>` appends to `host` (unless it's a self-placing factory like
      `openModal`/`toast`).
- [ ] Returns `{ el, update?, destroy? }`; add domain methods only if needed.
- [ ] Keep state in the closure, not on the DOM (`data-*` round-trips); re-render
      from `update(partial)`.
- [ ] Any global listener / subscription / timer is unwound in `destroy()` (§4).

**Styling**
- [ ] Only `var(--token)` — no hardcoded hex, rem, or durations.
- [ ] No `!important` (R3), no `#id` selectors (R5), no other component's classes (R4).

**Tests**
- [ ] `tests/<name>.test.ts` — imports `_dom-shim.ts`, mounts into a `FakeElement`,
      asserts the root carries `.amu-<name>`, that `update()`/`destroy()` behave,
      and that no foreign class survives. Run with `node --test`.

Then `npm run ci` (typecheck → audit → build → test) is the single gate.

---

## 4 · The destroy contract

`destroy()` must leave nothing behind — `page-assembly` will call it, and it
cascades in reverse mount order (a throwing child is swallowed so siblings still
tear down). The rule of thumb: **anything you add outside your own subtree, remove
in `destroy()`.**

```ts
const onResize = () => handle.resize();
window.addEventListener("resize", onResize);
const offTheme = onThemeChange(() => repaint());   // returns an unsubscribe

return {
  el: root,
  destroy: () => {
    offTheme();                                     // unsubscribe
    window.removeEventListener("resize", onResize); // same reference
    inflight?.abort();                              // abort pending requests
    root.remove();
  },
};
```

Local element listeners (added to nodes inside `root`) need no explicit removal —
they go when `root.remove()` does. The exceptions are **document-level delegated
listeners** bound once per module for the app's life (as `menu` and `omni` do); if
you take that route, document it, because it's a deliberate deviation from
"destroy removes everything."

Components that read theme tokens do so through **CSS** (`var(--token)`) and need
zero JS on a theme switch — the cascade re-resolves them. The single exception is a
canvas surface (like `chart`) that can't observe CSS vars: subscribe to
`onThemeChange`, re-read, and unsubscribe in `destroy()`
([O1-KNOBS](./O1-KNOBS.md) explains why this is the only listener seam).

---

## 5 · Token-only CSS

A component's `.css` uses only the frozen token contract, so it re-skins for free
under every theme × mode:

```css
/* card — a content tile. Sole owner of .amu-card*. */
.amu-card {
  padding: var(--sp-4);
  background: var(--surface);
  border: 1.5px solid var(--rule);
  border-radius: var(--radius);
  color: var(--text);
  box-shadow: var(--rule-shadow);
  transition: background var(--fast) var(--ease);
}
```

Structure tokens (`--sp-*`, `--radius*`, `--text-*`, `--row-h`, `--ctl-h`,
`--fast`/`--slow`/`--ease`, `--z-*`, `--bp-*`) live in `base.css`; palette tokens
(`--bg`, `--surface`, `--text`, `--accent`, `--signal`, `--rule`, `--chart-1..8`,
`--status-*`, …) are filled per theme × mode. The full list is
[THEME](../THEME.md). The audit ([DISCIPLINE](../DISCIPLINE.md)) enforces the
ownership rules; if you need a per-component tunable, expose it as a namespaced
CSS variable with a default (as `sql-editor` does with `--sqleditor-input-min-h`),
never a magic number.

---

## 6 · Add a theme

A look is data, not code — you fill the `--*` contract for a new `name × mode`
pair and register the name. The full recipe (with the token-by-token map) is
[THEME §Add a theme](../THEME.md#add-a-theme-the-extensibility-recipe); in brief:

1. `cp src/theme/themes/_template.css src/theme/themes/<client>.css`.
2. Fill **every** contract token for both
   `html[data-theme="<client>"][data-mode="dark"]` and `…[data-mode="light"]`.
3. `@import "src/theme/themes/<client>.css";` in `styles.css` (after the other themes).
4. Add `"<client>"` to `listThemes()` in `src/theme/theme.ts`.
5. `npm run ci` — `tests/theme-contract.test.ts` fails if any token is unfilled.

No component changes. The switch is `setTheme("<client>")` — one attribute write.

---

## 7 · Add an O(1) preference knob

Beyond theme × mode, a document-level preference (motion-reduce, high-contrast,
density, RTL, …) is a three-part move: a `[data-*]` CSS block, an
`applyDocumentPref` case that writes the attribute, and a registered pref so it
shows up in `settings-form`. The mechanism, the currently-live knobs, and a ranked
backlog of candidates (each with the exact attribute + tokens to touch) are in
[O1-KNOBS](./O1-KNOBS.md). The pattern in one breath:

```css
/* the CSS block — one attribute selector overriding tokens */
html[data-motion="reduced"] { --fast: 0s; --slow: 0s; --ease: linear; }
```
```ts
// the applyDocumentPref case (src/registry/pref-registry.ts) writes html[data-motion]
// then registerPref({ key: "motion", control: "toggle", … }) surfaces it in settings-form.
```

Because every component already reads the motion/space/color tokens, the knob
re-resolves the whole tree on one attribute write — no component edits, no re-mount.
That's the payoff of the token contract, and the reason "keep it data, not code" is
the framework's throughline.
