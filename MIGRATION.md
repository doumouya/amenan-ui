# Migration — web-kit → amenan-ui

The portfolio's "Console" web-kit and amenan-ui are reconciled into ONE package:
amenan-ui. web-kit's identity and its unique pieces now live in amenan-ui, and
web-kit is **retired but archived** (NOT deleted — the demos still import it until
they are separately repointed).

## What moved

| web-kit piece | lands in amenan-ui as |
|---|---|
| the "Console" look (ink/paper, one green signal, mono-first, hard rule + 4px offset block, flat elevation) | the **`portfolio`** theme — `src/theme/themes/portfolio.css` (fills the full token contract for both modes) |
| `tokens/{colors,typography,elevation,charts}.css` | folded into the `portfolio` token fills (the per-theme palette under `html[data-theme="portfolio"][data-mode]`) |
| `termbar` (the top strip) | `src/components/termbar/termbar.{ts,css}` — class `.amu-termbar*`, wired to `theme.ts` (its toggle calls `toggleMode()`, the label tracks `getMode()` via `onThemeChange`) |
| `perm-cell` cap / lock | merged into `src/components/perm-cell/perm-cell.{ts,css}` — a `cap?` ceiling that clamps the highest reachable tier; `cap = ""` is a permanently-locked guardrail (`data-locked="1"`) |
| `responsive.ts` | `src/kernel/responsive.ts` — `device`/`breakpoint`/`isTouch`/`isShort`/`isFolded`/`onChange` + `BREAKPOINTS`, reconciled with base.css's `--bp-*` rem tokens |
| `tabs` | `src/components/tabs/tabs.{ts,css}` — class `.amu-tabs*` (underline + segmented) |
| `code` | `src/components/code/code.{ts,css}` — class `.amu-code*` (inline / block) |
| `kindLabel` | `src/components/kindLabel/kindLabel.{ts,css}` — class `.amu-kind*` (Int/Float/Bool/Text × text/chip) |

Every ported piece is rebuilt to amenan conventions: the kernel `el` builder (NOT
web-kit's `el.ts`), co-located CSS `@import`ed by the `styles.css` manifest (NOT
web-kit's injected `ensureStyles` `<style>` tags — the single-owner audit model),
and amenan token names.

## Class + attribute renames

The ports are scrub-clean — every web-kit class prefix is renamed to the single
amenan `.amu-*` namespace (`.amu-termbar*` / `.amu-tabs*` / `.amu-code*` /
`.amu-kind*` / `.amu-perm*`), each its sole owner under the ui-fork-audit. No
web-kit class prefix, provenance string, or legacy storage key survives in
`src/**`; the `tools/scrub.mjs` gate enforces it.

## Token-name map (web-kit → amenan contract)

web-kit's namespace-prefixed tokens become the amenan contract names (see
[`THEME.md`](./THEME.md) for the full schema):

| web-kit | amenan contract |
|---|---|
| ink / paper surfaces | `--bg` / `--text` / `--surface` / `--surface-2` |
| the hard structural line (ink) | `--rule` (drawn at 1.5px) |
| the card offset block | `--rule-shadow` = `4px 4px 0 0 var(--rule)` |
| the one green | `--signal` / `--signal-hover` / `--signal-tint` (`--chart-1` = signal) |
| primary action (ink) | `--accent` |
| `elevation.css` floating tiers | `--shadow-popover` / `--shadow-dialog` |
| `typography.css` mono family | `--font` (mono-first for `portfolio`) |
| `charts.css` series | `--chart-1` … `--chart-8` |
| workflow states | `--status-backlog` / `--status-progress` / `--status-review` / `--status-done` |

## Theme-attribute migration (single-axis → two-axis)

amenan-ui keys a look on TWO axes: `html[data-theme="<name>"]` (theme) ×
`html[data-mode="dark"|"light"]` (mode). web-kit (and amenan's earlier single
axis) used one `data-theme` attribute for the dark/light *mode*.

- `:root` resolves to **redpash + dark**, so an attribute-less document renders
  the original default look.
- **Back-compat:** a persisted single-axis `amu-theme` of `"dark"`/`"light"`
  (with no `amu-mode`) is read by `theme.ts` as the **mode**, with the theme
  recovered to `redpash`. The platform then writes the two-axis attributes going
  forward. A document hardcoding the legacy mode attribute keeps rendering the old
  dark look.
- Going forward, set the look with `setTheme(name)` + `setMode(mode)` (or
  `toggleMode()`); `listThemes()` enumerates the registered names. See
  [`THEME.md`](./THEME.md).

## web-kit archive pointer

web-kit (`portfolio-repos/web-kit`) is **superseded by amenan-ui's `portfolio`
theme** and is kept ONLY as an archive until the demos
(csv-workbench / echarts-dashboard / rbac-explorer) are repointed at amenan-ui in
a separate change. Until then:

- **Do not extend web-kit.** New Console work lands in amenan-ui's `portfolio`
  theme + the ported components above.
- web-kit stays importable so the not-yet-repointed demos keep building — it is
  archived-but-present, not deleted.
- The demo repoint (Console demos → amenan-ui `portfolio`) and the eventual
  web-kit removal are tracked separately and are out of scope for this
  reconciliation.

This note is the canonical archive pointer for the reconciliation; web-kit itself
is left untouched (it is a read-only port source).
