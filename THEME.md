# Theme

amenan-ui ships a two-theme palette — **dark** (default) and **light** — over a
single token vocabulary. The token *names* are the public schema: a consumer
restyles by overriding the custom properties, never by forking a sheet.

## The `data-theme` contract

- The palette is keyed on `html[data-theme]`. `:root` carries the **dark**
  defaults, so a document with no `data-theme` renders dark.
- `html[data-theme="dark"]` and `html[data-theme="light"]` select the two
  palettes. `ThemeName = "dark" | "light"`.
- `src/theme/theme.ts` is the only runtime that reads/writes the choice:
  - `getTheme(): ThemeName` — persisted value (key `amu-theme`) → default `dark`.
  - `applyTheme(name)` — sets `html[data-theme]`, persists under `amu-theme`,
    notifies listeners.
  - `onThemeChange(fn)` — subscribe; returns an unsubscribe.
  - `prePaintSnippet` — the inline `<head>` script source that applies the
    persisted theme before first paint (no flash of the default theme). Embed it
    verbatim in `<head>` (see `index.html`).
- No migration from any prior key is performed — a clean slate keyed on
  `amu-theme`.

## Token families

Tier 1 (`:root`) is structure — theme-agnostic. Tier 2 is the per-theme palette.
The structural and palette tokens, in full:

### Tier 1 — structure (`:root`)

| Family | Tokens |
|---|---|
| spacing | `--sp-1`, `--sp-2`, `--sp-3`, `--sp-4`, `--sp-5`, `--sp-6`, `--sp-8` |
| radius | `--radius-sm`, `--radius`, `--radius-lg`, `--radius-pill` |
| type | `--font`, `--font-mono`, `--text-xs`, `--text-sm`, `--text-md`, `--text-lg`, `--text-xl`, `--text-2xl` |
| density | `--row-h`, `--ctl-h`, `--pad-x`, `--gap`, `--topbar-h`, `--rail-w` |
| motion | `--ease`, `--fast`, `--slow` |
| breakpoints | `--bp-lg`, `--bp-md`, `--bp-sm` |

### Tier 2 — palette (per `data-theme`)

| Family | Tokens |
|---|---|
| surface | `--bg`, `--surface`, `--surface-2` |
| border | `--border` |
| text | `--text`, `--text-dim`, `--text-mute` |
| accent | `--accent`, `--accent-soft`, `--on-accent` |
| status | `--ok`, `--warn`, `--info`, `--danger` |
| effect | `--hover`, `--glass`, `--glass-blur`, `--shadow`, `--ring` |

The full palette (including `--glass`/`--glass-blur` for glassmorphism and the
`--info` status color) is kept in both themes; `color-scheme` is set per theme.

## Linking the tokens

In dev, link `styles.css` (the `@import` manifest — tokens first). In a build,
link the flattened `dist/tokens.css` (manifest order = cascade order). Both carry
the same `--*` token vocabulary.
