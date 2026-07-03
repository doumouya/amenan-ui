# O(1) knobs — cross-cutting state as a single attribute write

> An overview of everything in amenan-ui (and the RedPash frontend it was extracted from) that is — or could be —
> an **O(1) operation**: flipping a whole-app concern by writing **one `html[data-*]` attribute**, letting the CSS
> custom-property cascade re-resolve the entire tree in one repaint. No component re-mount, no JS restyle loop, no
> cached values. This doc is the map: what's live, what's half-wired, what's intentionally not O(1), and the backlog
> of concerns worth decoupling into a knob.

## The pattern

Every component styles itself off `var(--token)`. Every theme/mode/knob is a **named block keyed on a document
attribute** (`html[data-theme="…"]`, `html[data-mode="…"]`, `html[data-density="…"]`, …) that fills those tokens.
So changing the app's whole appearance is:

```
document.documentElement.dataset.mode = "dark";   // ← the entire operation
```

One attribute write → the browser re-resolves every `var(--token)` reference in a single native repaint. That's the
"O(1)": the *switch call* is constant-time and touches only `documentElement` + `localStorage`, regardless of how many
components are mounted. Contrast the anti-pattern (walk the DOM, recompute class lists, re-mount, or cache colors in JS),
which is O(components) and drifts.

---

## A. Live O(1) (shipped + working in amenan-ui)

### Theme × Mode — the two-axis platform
- **Attributes:** `html[data-theme="redpash|portfolio|numu"]` × `html[data-mode="dark|light"]`.
- **API** (`src/theme/theme.ts`): `setTheme(name)` / `setMode(mode)` / `toggleMode()` / `getTheme()` / `getMode()` /
  `listThemes()` / `onThemeChange(fn)` / `prePaintSnippet`. Each setter writes **exactly one** documentElement attribute +
  one `localStorage` entry (`amu-theme` / `amu-mode`) + fires listeners — nothing else.
- **Contract:** every theme fills the same token set (structure tokens in `src/theme/base.css`; palette + Console
  vocabulary per theme×mode in `src/theme/themes/{redpash,portfolio,numu,_template}.css`) — `--bg`, `--surface`, `--text`,
  `--accent`, `--signal`, `--rule`, `--chart-1..8`, `--status-*`, `--font`, … Components reference `var(--token)` only.
- **Why O(1):** one attribute write; the cascade does the rest. Verified by the theme-switch tests
  (`tests/theme-switch.test.ts`) — `setTheme`/`setMode` touch only `documentElement` + storage.
- **FOUC:** `prePaintSnippet` (inline in `<head>`) applies the persisted theme+mode before first paint.

This is the reference implementation of the pattern and the reason the portfolio + all three demos re-theme instantly.

---

## B. Wired but inert in amenan-ui (mechanism ships; the override CSS isn't ported yet)

These two knobs have their **plumbing** in amenan-ui but not their **effect** — a small, well-scoped gap.

### Density
- **Mechanism (present):** `applyDocumentPref("density", value)` (`src/registry/pref-registry.ts`) writes
  `html[data-density]` (or deletes it for `"default"`); persisted under `amu-pref-density`; FOUC-mirrored at boot.
- **Tokens (present):** `base.css` defines the rhythm tokens `--row-h` / `--ctl-h` / `--pad-x` / `--gap` and comments them
  as "one knob, not per-sheet."
- **Missing:** the override block `html[data-density="compact"]{ --row-h:…; --ctl-h:…; --pad-x:…; --gap:… }` is **not in
  amenan-ui** — it lives in RedPash `frontend/styles/prefs.css`. So today `applyDocumentPref("density","compact")` writes
  the attribute but nothing re-tunes. **To make it live:** port the ~2 blocks from RedPash's `prefs.css` into amenan-ui's
  theme layer (a few lines; no component changes — they already read the tokens in `rem`).

### Font-size
- **Mechanism (present):** `applyDocumentPref("fontsize", value)` writes `html[data-fontsize]` (persisted `amu-pref-fontsize`,
  FOUC-mirrored).
- **Missing:** the `html[data-fontsize="sm|lg"]{ font-size:… }` block (RedPash `prefs.css`). Once ported, the whole `rem`
  cascade (`--text-*`, spacing) scales from one `:root` font-size. **To make it live:** port the block.

> These are the fastest "complete an O(1) knob" wins — the hard part (mechanism + token design) already shipped.

The **RedPash frontend** (`redpash-rust-pwa/frontend`) has all three (theme, density, font-size) fully wired in
`styles/prefs.css` — it's the reference for the blocks to bring over.

---

## C. Not O(1) — by design

- **Responsive device-class** (`src/kernel/responsive.ts`): `device()` / `breakpoint()` / `onChange()` are **JS signals for
  behavior**, not layout. Layout is O(1)-by-CSS already (`@media`, `clamp`, container queries). `device()` exists only for
  the rare case where *code* (not style) must branch on the device — writing `html[data-device]` on every resize would be
  the expensive anti-pattern.
- **Chart canvas** (`src/components/chart/*`): the **sole JS exception**. ECharts bakes its theme at `init()` and can't
  observe CSS vars, so the chart subscribes to `onThemeChange`, disposes, re-inits with the re-resolved tokens, and
  re-applies its option. Cost = the few visible charts, not the whole tree — and the switch *call* stays O(1). This is why
  the `onThemeChange` seam exists.

---

## D. Enabling principles (why the pattern holds)

1. **CSS custom properties on `:root` / `[data-*]`** — the cascade is the engine; one attribute re-resolves every reference.
2. **A stable token contract** — a frozen superset every theme fills; components couple to token *names*, never to a theme.
3. **Single-attribute selectors** — each concern gets one attribute (`data-theme`, `data-mode`, `data-density`, …); no
   component branches on it in JS.
4. **Listener seams for the exceptions** — `onThemeChange` (theme.ts) + `onPrefChange` (pref-registry.ts) are the *only*
   allowed JS reactions, reserved for what can't re-resolve through CSS (canvas, analytics).
5. **Derive, don't store** — appearance is derived from the current `html[data-*]` + the cascade; there is no second
   storage path (no JS color cache, no per-component class list).
6. **FOUC prepaint** — an inline `<head>` script applies persisted attributes before first paint.

**Adding a new O(1) knob is a 3-step recipe** (thanks to `applyDocumentPref`):
1. a CSS block `html[data-<knob>="<value>"]{ /* override the relevant tokens */ }` in the theme layer;
2. an `applyDocumentPref` case that writes/deletes `html[data-<knob>]`;
3. register the pref (so it persists + FOUC-mirrors + shows in a settings surface).

---

## E. Candidate backlog — concerns worth decoupling into an O(1) knob

Each is a cross-cutting concern that today would be per-component / JS-driven, and that the 3-step recipe turns into a
single-attribute flip. Ranked by value ÷ lift. (None are implemented — this is the backlog.)

| # | Knob | Attribute | Touches (tokens) | Lift | Why |
|---|---|---|---|---|---|
| 0 | **Finish density / font-size** | `data-density`, `data-fontsize` | `--row-h/--ctl-h/--pad-x/--gap`, `:root font-size` | **XS** | Mechanism already ships (§B) — just port the RRP `prefs.css` blocks. |
| 1 | **motion-reduce** | `data-motion` | `--fast`, `--slow`, `--ease` | XS | `html[data-motion="reduced"]{--fast:0s;--slow:0s;--ease:linear}` — components already use the motion tokens. Seed from `matchMedia("(prefers-reduced-motion)")`. a11y. |
| 2 | **high-contrast** | `data-contrast` | existing palette (`--text*`, `--border`, `--rule`) | S | Per theme×mode `[data-contrast="high"]` palette overrides; reuses the contract. WCAG AAA. |
| 3 | **RTL direction** | `data-dir` | none new (CSS **logical properties**) | M | `direction:rtl` + migrate component `margin-left`→`margin-inline-start` etc. The one candidate that touches component CSS. i18n. |
| 4 | **print mode** | `data-print` | `--bg`,`--text`,`--shadow`,`--glass-blur` + hide chrome | S | Paper/ink palette + `display:none` topbar/rail; wire a `matchMedia("print")` listener. |
| 5 | **color-blind palettes** | `data-colorblind` | `--chart-1..8`, `--status-*` | M | Okabe-Ito-safe hue overrides so charts stay distinguishable. Needs palette research. |
| 6 | **per-client skin** | `data-skin` | existing palette | S | Sub-theme variants *within* a theme (e.g. Loracle corporate vs creative) — formalizes the numu/Loracle extensibility as a second axis. |
| 7 | **rail-mode** | `data-rail-mode` | `--rail-w`, `--z-rail` | M | full / compact / drawer as one attribute (today a JS `.compact` class + `@media`). The *layout-mode choice* is O(1); the drawer open/close toggle stays JS. |

**Recommended order if picking these off:** 0 (complete what's wired) → 1 (motion, XS + a11y) → 2 (contrast) → 4 (print) →
3 (RTL, once logical-property migration is scoped) → 6/5/7 as needed.

---

## Files referenced
- `src/theme/theme.ts` — the two-axis theme/mode API (the live O(1) reference).
- `src/theme/base.css` — structure tokens incl. the density rhythm + motion tokens.
- `src/theme/themes/*.css` — the per-theme×mode palette blocks (where new `[data-*]` override blocks would live).
- `src/registry/pref-registry.ts` — `applyDocumentPref` (the knob-writing mechanism) + pref registration/FOUC.
- `src/kernel/responsive.ts` — the intentionally-JS device-class signals.
- `src/components/chart/*` — the sole `onThemeChange` canvas exception.
- (reference) `redpash-rust-pwa/frontend/styles/prefs.css` — the density/font-size override blocks to port (§B).
