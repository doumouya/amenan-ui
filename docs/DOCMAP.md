# Doc map

amenan-ui is a standalone, dependency-free, theme-agnostic vanilla-TypeScript UI
framework — a tiny `dom` builder, three registries, a declarative `page-assembly`,
a generic hash `router`, and a ~40-component library, held together by one
CI-enforced single-CSS-ownership discipline.

This file is the index. The docs split in two: a short **root tier** (the
overview + the two hardest-to-reverse contracts) and a deeper **`docs/` tier**
(the reference material you reach for once you're building).

## The map

| Doc | Tier | Covers | Read it when |
|---|---|---|---|
| [README](../README.md) | root | the elevator pitch, install, the seams, the CI gate | first contact — what is this, how do I pull it in |
| [THEME](../THEME.md) | root | the frozen `--*` token contract, the two-axis selector, the add-a-theme recipe | you're theming, or adding a client look |
| [DISCIPLINE](../DISCIPLINE.md) | root | the single-CSS-ownership invariant (R3–R6) + the ratchet | you're touching CSS, or CI's audit failed |
| [DEPENDENCY-MAP](../DEPENDENCY-MAP.md) | root | the layer graph + the LEAF/COMPOSED/DATA classification (terse) | you want the one-screen shape |
| [GETTING-STARTED](./GETTING-STARTED.md) | docs | link the tokens, kill FOUC, mount a component, compose a page + router, build | you're writing your first amenan-ui page |
| [ARCHITECTURE](./ARCHITECTURE.md) | docs | the two-tier Mount contract, the handle lifecycle, the four seams, the registries, data flow | you want to know *why* it's shaped this way before extending it |
| [COMPONENTS](./COMPONENTS.md) | docs | the full API reference — every component's signature, config, handle | you're mounting a specific component and need its exact config |
| [AUTHORING](./AUTHORING.md) | docs | add a component / a theme / an O(1) knob; the `el` helper; cleanup + CSS rules | you're adding to the framework, not just consuming it |
| [O1-KNOBS](./O1-KNOBS.md) | docs | what's already an O(1) `[data-*]` knob, and the ranked backlog of new ones | you want to add a document-level preference (motion, contrast, RTL…) |

## Reading paths

- **"I just want to use it in my app."** → [GETTING-STARTED](./GETTING-STARTED.md),
  then dip into [COMPONENTS](./COMPONENTS.md) per component. Theme it via
  [THEME](../THEME.md).
- **"I want to understand the design."** → [ARCHITECTURE](./ARCHITECTURE.md)
  (the *why*) over [DEPENDENCY-MAP](../DEPENDENCY-MAP.md) (the *what*).
- **"I'm adding a component / theme / preference."** → [AUTHORING](./AUTHORING.md),
  with [DISCIPLINE](../DISCIPLINE.md) for the CSS rules and
  [THEME](../THEME.md) / [O1-KNOBS](./O1-KNOBS.md) for the two extension recipes.
- **"I'm making a document-level look an O(1) switch."** → [O1-KNOBS](./O1-KNOBS.md).

## The one mental model

Everything below rests on a single shape. A component is a **`Mount`** — a
function that takes a host element and returns a **`MountHandle`** (`{ el,
update?, destroy? }`). The registry, `page-assembly`, and `router` only ever see
`Mount`s, so `destroy()` always cascades and the whole tree tears down cleanly.
A look is **data** (a `--*` token contract), not code, so a theme switch is one
attribute write. If you internalize those two facts,
[ARCHITECTURE](./ARCHITECTURE.md) is just the details.

## Source of truth

The **code is the contract**; these docs describe it. Where a doc and the source
disagree, the source wins — and the `tests/` enforce the load-bearing claims
(`theme-contract.test.ts` freezes the token set, `page-assembly.test.ts` pins the
mount/destroy cascade, `chart-theme-reaction.test.ts` proves the one JS theme
exception). Run the gate with `npm run ci` (typecheck → audit → build → test).
