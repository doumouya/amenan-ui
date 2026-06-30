# Theme

amenan-ui is an **extensible theme platform**. A look is two axes — a theme
**name** (`redpash` · `portfolio` · `numu` · any future client) × a **mode**
(`dark` | `light`) — keyed on `html[data-theme="<name>"]` × `html[data-mode]`.
Every theme fills the SAME frozen **token contract**: the `--*` token *names* are
the public schema, and a switch is one attribute write that re-skins the whole
tree through the CSS cascade.

- **Structure** (spacing, radius, type scale, density, motion, breakpoints,
  z-index, the shared `--font-mono`) is theme-agnostic and lives once in
  `src/theme/base.css`.
- **Palette** (every contract token below) is filled per theme × mode in
  `src/theme/themes/<name>.css`.
- `styles.css` is the single `@import` manifest: `base.css` first, then each
  theme file (the build flattens it into `dist/tokens.css` in manifest = cascade
  order).

## The token contract (the public SCHEMA)

This is the FROZEN superset **every** registered theme MUST fill for BOTH modes
(`tests/theme-contract.test.ts` enforces it). Adding a name requires a spec
revision. Group A is structure (in `base.css`, shared); groups B–C are palette
(per theme × mode).

### A — structure (`base.css`, theme-agnostic)

| Family | Tokens | Meaning |
|---|---|---|
| spacing | `--sp-1` … `--sp-6`, `--sp-8` | the spacing step scale |
| radius | `--radius-sm`, `--radius`, `--radius-lg`, `--radius-pill` | corner radii |
| type (mono) | `--font-mono` | the shared monospace family (data / identifiers / code) |
| type scale | `--text-xs`, `--text-sm`, `--text-md`, `--text-lg`, `--text-xl`, `--text-2xl` | font-size ramp |
| density | `--row-h`, `--ctl-h`, `--pad-x`, `--gap`, `--topbar-h`, `--rail-w` | the calm-density rhythm knobs |
| motion | `--ease`, `--fast`, `--slow` | transition curve + durations |
| z-index | `--z-base`, `--z-rail`, `--z-topbar`, `--z-side-panel`, `--z-popover`, `--z-toast`, `--z-modal` | the stacking contract |
| breakpoints | `--bp-lg`, `--bp-md`, `--bp-sm` | the CSS source of truth (the JS one is `kernel/responsive.ts` `BREAKPOINTS`) |

### B — palette: today's vocabulary (per theme × mode)

| Family | Tokens | Meaning |
|---|---|---|
| surface | `--bg`, `--surface`, `--surface-2` | page / card / raised-or-sunken surfaces |
| border | `--border` | the soft hairline (dividers, table rows) |
| text | `--text`, `--text-dim`, `--text-mute` | primary / secondary / muted text |
| accent | `--accent`, `--accent-soft`, `--on-accent` | primary-action color, its tint, text-on-accent |
| status | `--ok`, `--warn`, `--info`, `--danger` | the semantic status hues |
| effect | `--hover`, `--glass`, `--glass-blur`, `--shadow`, `--ring` | hover wash, glass wash + blur, base shadow, focus ring frame |
| font | `--font` | the per-theme display/body family (mono-first for `portfolio`) |
| scheme | `color-scheme` | the native form/scrollbar scheme |

### C — palette: the Console vocabulary (NEW, per theme × mode)

| Family | Tokens | Meaning |
|---|---|---|
| signal | `--signal`, `--signal-hover`, `--signal-tint` | the ONE brand signal (active / success / links) + its hover step + soft fill |
| rule | `--rule`, `--rule-shadow` | the hard structural line color + the card block / offset shadow |
| focus | `--focus-ring` | the focus-ring color |
| charts | `--chart-1` … `--chart-8` | the 8-series chart palette (`--chart-1` = signal by convention) |
| status (workflow) | `--status-backlog`, `--status-progress`, `--status-review`, `--status-done` | the workflow-state hues |
| elevation (flat) | `--shadow-popover`, `--shadow-dialog` | floating-layer + dialog elevation (the flat tiers) |

> `--font` moved from structure into the palette tier: `portfolio` is mono-first,
> so the display/body family is now a per-theme choice. The shared `--font-mono`
> stays in `base.css`.

## redpash ↔ portfolio (the key value map)

Both themes fill the identical contract; only the **values** differ. `redpash`
byte-preserves the original red/glass/sans look; `portfolio` is the Console
identity (ink/paper, one green signal, mono-first, hard rule + offset block).

| Token | redpash (dark / light) | portfolio (dark / light) — the Console traits |
|---|---|---|
| `--font` | system sans stack | mono-first stack — `ui-monospace, …, monospace` |
| `--bg` / `--text` | `#0c0d10` / `#e6e8ec` · `#fafafb` / `#1a1d23` | ink/paper — `#0B0B0C` / `#F2F2F3` · `#FFFFFF` / `#0B0B0C` |
| `--accent` | red `#f04438` (both modes) | ink — `#F2F2F3` (dark) / `#0B0B0C` (light) |
| `--signal` | `var(--ok)` `#2dd4a7` / `#0e9f6e` | the ONE green — `#34C77B` (dark) / `#1E9E5A` (light) |
| `--rule` | `var(--border)` (soft hairline) | hard ink line — `#F2F2F3` / `#0B0B0C`, drawn at 1.5px |
| `--rule-shadow` | `var(--shadow)` (no offset — redpash stays soft) | the offset block — `4px 4px 0 0 var(--rule)` |
| `--shadow` | a soft drop shadow | `none` — base surfaces are FLAT |
| `--glass-blur` | `14px` (glassmorphism) | `0px` (Console is flat — no blur) |
| `--shadow-popover` / `--shadow-dialog` | aliases of `--shadow` (flat tiers) | the web-kit `elevation.css` floating tiers |
| `--focus-ring` | `var(--accent)` (red) | green (= `--signal`) |
| `--chart-1..8` / `--status-*` | RedPash-tinted | web-kit `charts.css` / workflow states (`--chart-1` = signal) |

`numu` is a documented WIP slot: it fills every contract token for both modes
with redpash-derived placeholders, each carrying a `/* TODO(numu): … */` marker,
so the slot resolves (no unfilled `var(--…)`) and the showcase can switch to it.
Its true brand tokens land in a later milestone.

## The two-axis selector + back-compat

- Each theme file fills its tokens under
  `html[data-theme="<name>"][data-mode="dark"]` AND `…[data-mode="light"]`.
- `:root` resolves to **redpash + dark** when no attribute is set, so an
  attribute-less document renders the original default look.
- `src/theme/theme.ts` is the only runtime that reads/writes the choice — two
  document attributes + a `localStorage` mirror (`amu-theme` = the NAME,
  `amu-mode` = the mode):
  - `getTheme(): ThemeName` / `getMode(): Mode` — the persisted values (default
    `redpash` / `dark`).
  - `setTheme(name)` — writes `html[data-theme]`, persists `amu-theme`, fires
    listeners. **O(1)**: nothing else (no component DOM scan, no style loop, no
    re-mount).
  - `setMode(mode)` / `toggleMode()` — the same one-write contract on `data-mode`
    / `amu-mode`.
  - `listThemes(): ThemeName[]` — the registered names, static (no DOM scan).
  - `onThemeChange(fn)` — subscribe (`fn(theme, mode)`); returns an unsubscribe.
    The chart canvas is the sole JS reaction to a switch — it re-reads tokens via
    `getComputedStyle`; everything else re-resolves through the CSS cascade.
  - `prePaintSnippet` — the inline `<head>` script source that sets BOTH
    attributes before first paint (no FOUC). Embed it verbatim (see `index.html`).
- **Back-compat:** a document carrying only the legacy single-axis
  `html[data-theme="dark"]` still renders the old dark look. On read, a persisted
  `amu-theme` of `"dark"`/`"light"` (with no `amu-mode`) is interpreted as the
  **mode** and the theme recovers to `redpash`; the platform writes the two-axis
  attributes going forward.

## Add a theme (the extensibility recipe)

The pattern `numu`, future clients (Loracle, …) all follow — five steps, then CI
verifies the new theme fills every contract token:

1. `cp src/theme/themes/_template.css src/theme/themes/<client>.css`
   (`_template.css` lists every contract token as a blank slot, grouped by
   family; it is imported but INERT — its vars sit under the unused
   `html[data-theme="_template"]` selector, so it leaks nothing for shipped
   themes).
2. fill EVERY contract token (the A–C superset above) for
   `html[data-theme="<client>"][data-mode="dark"]` AND `…[data-mode="light"]`.
3. add `@import "src/theme/themes/<client>.css";` to `styles.css` (after the
   other themes — manifest order is cascade order).
4. add `"<client>"` to `listThemes()` in `src/theme/theme.ts`; switch with
   `setTheme("<client>")`.
5. `npm run ci` — `tests/theme-contract.test.ts` asserts the new theme fills
   every token for both modes; the build flattens it into `dist/tokens.css`.

## Linking the tokens

In dev, link `styles.css` (the `@import` manifest — `base.css` + every theme
first, then component sheets). In a build, link the flattened `dist/tokens.css`
(manifest order = cascade order). Both carry the same `--*` contract.
