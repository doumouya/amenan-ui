# Component reference

Every component in the library, with its exact signature, config, and handle —
extracted from source. For the shape all of these share, read
[ARCHITECTURE §2–3](./ARCHITECTURE.md#2--the-mount-contract-the-one-shape); to
add one, [AUTHORING](./AUTHORING.md).

## How to read an entry

- **Signature** is copied verbatim from source. Most components are
  `mountX(host, cfg) → handle`. A few are **factories** that place themselves and
  take no `host` — `openModal`/`confirmModal`/`toast`, the `atoms` builders, and
  `renderMarkdown`; these are flagged in their **Notes**.
- **Handle** is the base `MountHandle<U> = { el, update?(partial: U), destroy?() }`
  unless an entry lists extra methods (e.g. `surface.section(key)`).
- **Config** lists the real fields of the primary `*Cfg` interface. `?` = optional.
- **Seam** (DATA tier only) names the injected callback/source the component reads
  data through — there is no hardwired transport anywhere in the library.
- Each component is the **sole owner** of its `.amu-<name>*` CSS namespace
  ([DISCIPLINE](../DISCIPLINE.md)).

## Index

- **LEAF** (pure DOM, no service): [atoms](#atoms) · [card](#mountcard) ·
  [empty-state](#mountemptystate) · [modal](#openmodal--confirmmodal) ·
  [menu](#mountmenu) · [select](#mountselect) · [toast](#toast) · [stat](#mountstat) ·
  [field](#mountfield) · [chip-row](#mountchiprow) · [pager](#mountpager) ·
  [surface](#mountsurface) · [markdown](#rendermarkdown) · [uploader](#mountuploader) ·
  [score-badge](#mountscorebadge) · [side-panel](#mountsidepanel) ·
  [dashboard-grid](#mountdashboardgrid) · [grid-toolbar](#mountgridtoolbar) ·
  [report-builder](#mountreportbuilder) · [settings-form](#mountsettingsform) ·
  [tabs](#mounttabs) · [code](#mountcode) · [kindLabel](#mountkindlabel)
- **COMPOSED** (layout/theme, no service): [chart](#mountchart) ·
  [filter-panel](#mountfilterpanel) · [grid-view](#mountgridview) ·
  [redtable](#mountredtable) · [column-manager](#mountcolumnmanager) ·
  [joins-wizard](#mountjoinswizard) · [sql-editor](#mountsqleditor) ·
  [steps-panel](#mountstepspanel) · [workspace-panels](#mountworkspacepanels) ·
  [topbar](#mounttopbar) · [rail](#mountrail) · [termbar](#mounttermbar)
- **DATA** (service-coupled via a seam): [seam types](#seam-types) ·
  [perm-cell](#mountpermcell) · [omni](#mountomni) ·
  [message-thread](#mountmessagethread) · [chart-editor](#mountcharteditor) ·
  [rail-data](#mountraildata) · [object-list](#mountobjectlist)
- **ENGINE** (optional, injected-wasm): [engine loader](#configureengine--getengine) ·
  [window-source](#serversource--clientsource--picksource)

---

## LEAF tier

Pure DOM — no domain, no service. The `atoms` are the vocabulary the rest compose;
a LEAF never re-implements another.

## atoms

The lowest-level builders, all in `src/components/atoms/atoms.ts`. Each returns a
**raw element** (not a `MountHandle`) — append it yourself, or hand it to a
component that takes a `Node` (e.g. `field`, `menu`'s `trigger`).

### `button` — a text or icon-only button
```ts
button(cfg: ButtonCfg): HTMLButtonElement
```
**Purpose.** The button atom. `icon` + no `label` renders a square icon-only
button (`.amu-btn--icon`) — always give one a `title`/`ariaLabel`.
**Config (`ButtonCfg`).**
| field | type | meaning |
|---|---|---|
| `label` | `string?` | button text |
| `icon` | `string?` | a Bootstrap Icons name (e.g. `"bi-layout-sidebar"`) |
| `variant` | `"accent" \| "ghost" \| "danger"?` | visual variant |
| `size` | `"sm"?` | only `"sm"` is defined today |
| `onClick` | `EventListener?` | click handler |
| `disabled` | `boolean?` | disables the button |
| `type` | `"button" \| "submit" \| "reset"?` | HTML button type (default `"button"`) |
| `title` | `string?` | tooltip / accessible-name fallback |
| `ariaLabel` | `string?` | explicit aria-label (falls back to `title`) |

**Notes.** Composed by empty-state, modal, surface, side-panel, grid-toolbar,
report-builder. `aria-label` resolves to `ariaLabel ?? title`.

### `chip` — a pill selector
```ts
chip(cfg: ChipCfg): HTMLButtonElement
```
`ChipCfg = { label: string; active?: boolean; onClick?: EventListener }`. Renders
`.amu-chip` with `aria-pressed`. Consumed by chip-row.

### `input` — a single-line text input
```ts
input(cfg: InputCfg = {}): HTMLInputElement
```
`InputCfg = { placeholder?; value?; type?; onInput?(value); onEnter?(value) }`.
`type` defaults to `"text"`. `onInput` fires on every keystroke; `onEnter` on the
Enter key. Composed by grid-toolbar (search) and settings-form.

### `textarea` — the multiline input
```ts
textarea(cfg: TextareaCfg = {}): HTMLTextAreaElement
```
`TextareaCfg = { placeholder?; value?; rows?; onInput?(value) }`. `rows` defaults
to `3`. No `onEnter` (unlike `input`).

### `badge` — a soft-tint label pill
```ts
badge(cfg: BadgeCfg): HTMLSpanElement
```
`BadgeCfg = { label: string; tone?: "ok" | "warn" | "danger" | "info" | "accent" }`.

### `spinner` — async feedback indicator
```ts
spinner(): HTMLSpanElement
```
No args. Renders `.amu-spinner` with `role="status"`, `aria-label="Loading"`.
Composed by uploader.

### `kbd` — a keyboard hint
```ts
kbd(label: string): HTMLElement
```
Takes a bare `label` string (not a cfg). Renders a `<kbd>`.

### `icon` — a Bootstrap Icons glyph
```ts
icon(name: string, cfg: IconCfg = {}): HTMLElement
```
`IconCfg = { size?: string; color?: string; label?: string }`. Takes the **bare**
icon name (`icon("funnel")` → `<i class="amu-icon bi bi-funnel">`) — unlike
`ButtonCfg.icon`, which predates this atom and keeps its prefixed form. Inherits
`currentColor` and the surrounding text size unless `color`/`size` (any CSS
values, typically token refs like `"var(--accent)"`) are given. Decorative by
default (`aria-hidden`); pass `label` ONLY when the icon carries meaning on its
own. The host page provides the bootstrap-icons stylesheet.

## `mountCard`
```ts
mountCard(host: Element, cfg: CardCfg): MountHandle
```
**Purpose.** A content tile — an `<a>` when `href` is set, a `<button>` when
`onClick` is set, else a `<div>`.
**Config (`CardCfg`).**
| field | type | meaning |
|---|---|---|
| `title` | `string?` | rendered as `<h3>` |
| `sub` | `string?` | subtitle `<p>` |
| `href` | `string?` | renders as a link |
| `onClick` | `EventListener?` | renders as a button (when no `href`) |
| `body` | `Child?` | arbitrary content appended after title/sub |

**Handle.** Base `MountHandle`; `update()` is a no-op.

## `mountEmptyState`
```ts
mountEmptyState(host: Element, cfg: EmptyStateCfg): MountHandle
```
**Purpose.** Title + one line + ONE action — "the empty state IS the onboarding."
**Config (`EmptyStateCfg`).** `{ title: string; line?: string; action?: EmptyStateAction }`,
where `EmptyStateAction = { label; variant?; onClick? }`.
**Notes.** Composes `atoms.button` (action defaults to `variant:"accent"`).

## `openModal` / `confirmModal`
```ts
openModal(cfg: ModalCfg): ModalHandle              // { el, close }
confirmModal(cfg: ConfirmModalCfg): Promise<boolean>
```
**Purpose.** Create + confirm-destructive dialogs only ("everything else is
inline"). `openModal` builds an overlay; `confirmModal` wraps it as a yes/no
promise.
**Config (`ModalCfg`).** `{ title: string; body?: Child; actions?: ModalAction[] }`;
`ModalAction = { label; variant?; onClick?(api: { close }) }`.
**Config (`ConfirmModalCfg`).** `{ title: string; message?; confirmLabel?; danger? }`
(`confirmLabel` default `"Confirm"`).
**Handle.** `openModal` → `ModalHandle = { el, close }` (teardown is `close()`, not
`destroy`). `confirmModal` → `Promise<boolean>`.
**Notes.** Factories — no `host`. Append the overlay to `document.body`; register a
document `keydown` (Escape closes) removed by `close()`; close on backdrop click;
auto-focus the first control. Compose `atoms.button`.

## `mountMenu`
```ts
mountMenu(host: Element, cfg: MenuCfg): MountHandle<MenuUpdate>
```
**Purpose.** A dropdown using ONE document-level delegated listener (covers every
trigger, even dynamically rendered ones).
**Config (`MenuCfg`).** `{ trigger: HTMLElement; items?: MenuItem[] }`. A `MenuItem`
is an action (`{ label; icon?; onSelect?; selected? }`), a separator (`{ sep: true }`),
or a heading (`{ label; heading: true }`).
**Handle.** Base `MountHandle<MenuUpdate>`; `MenuUpdate = { items? }` re-renders.
**Notes.** Installs a single shared document `click`/`keydown` delegation once per
module — **not** removed by `destroy()` (only `wrap.remove()` runs). Escape closes
all open menus. Composed by grid-toolbar and topbar.

## `mountSelect`
```ts
mountSelect(host: Element, cfg: SelectCfg): MountHandle<SelectUpdate>
```
**Purpose.** Single-choice over the native `<select>` ("keyboard, a11y, mobile
come free").
**Config (`SelectCfg`).** `{ options?: {value,label}[]; value?; onChange?(value) }`.
**Handle.** `SelectUpdate = { options?; value? }`. Composed by report-builder,
settings-form.

## `toast`
```ts
toast(cfg: ToastCfg): MountHandle
```
**Purpose.** Transient feedback — the partner of optimistic UI (pair every
optimistic mutation with a toast carrying a revert action on failure).
**Config (`ToastCfg`).** `{ message: string; tone?: "danger" | "ok" | "warn" | "info";
title?: string; mono?: boolean; action?: { label; onClick? }; ttl? }`
(`ttl` default 6000 with an action, else 3000). `title` renders as a bold first
line above the message; `mono` puts the message in the mono data voice (ids,
counts, commands); `tone` colors the border (danger keeps its stronger look).
**Notes.** Factory — no `host`. Lazily appends a shared `.amu-toast-stack`
(`role="status"`, `aria-live="polite"`) to `document.body`. Auto-removes after
`ttl`. Handle exposes `{ el, destroy }` (no `update`).

## `mountStat`
```ts
mountStat(host: Element, cfg: StatCfg): MountHandle<StatUpdate>
```
**Config (`StatCfg`).** `{ label: string; value: string | number; tone?: "ok"|"warn"|"danger"; sub? }`.
**Handle.** `StatUpdate = { value?; tone? }` patches in place.

## `mountStatStrip`
```ts
mountStatStrip(host: Element, cfg: StatStripCfg): StatStripHandle
```
A responsive row of `mountStat` tiles. `StatStripCfg = { stats?: StatCfg[] }`.
**Handle** adds `handles: MountHandle<StatUpdate>[]` — patch an individual tile via
`handles[i].update(...)` (the strip's own `update` is a no-op).

## `mountField`
```ts
mountField(host: Element, cfg: FieldCfg): MountHandle<FieldUpdate>
```
**Purpose.** A labeled form row wrapping any control node (rendered as `<label>`).
**Config (`FieldCfg`).** `{ label: string; help?; control: Node; inline?; bare? }`.
**Handle.** `FieldUpdate = { error?: string | null }` — a non-null error appends
`.amu-field-error`; `null` clears it. Composed by settings-form.

## `mountChipRow`
```ts
mountChipRow(host: Element, cfg: ChipRowCfg): MountHandle<ChipRowUpdate>
```
Single-select tabs over `atoms.chip` (`role="tablist"`).
`ChipRowCfg = { items?: {value,label}[]; value?; onChange?(value) }`. Clicking the
active chip is a no-op. `ChipRowUpdate = { items?; value? }`.

## `mountPager`
```ts
mountPager(host: Element, cfg: PagerCfg): MountHandle<PagerUpdate>
```
Rows-info + a numbered page window (≤5 around current) + prev/next.
`PagerCfg = { page: number; pages: number; total: number; onPage?(page) }`
(`total` shown via `toLocaleString()`). `PagerUpdate = Partial<PagerCfg>`.

## `mountSurface`
```ts
mountSurface(host: Element, cfg: SurfaceCfg): SurfaceHandle
```
**Purpose.** The content frame (`<main>`): an optional head band (title · meta ·
actions) plus named sections a page mounts data components into.
**Config (`SurfaceCfg`).**
| field | type | meaning |
|---|---|---|
| `title` | `string?` | head-band title |
| `meta` | `string?` | head-band meta (span always present so `update({meta})` works later) |
| `actions` | `ButtonCfg[]?` | head-band buttons |
| `sections` | `SurfaceSection[]?` | `{ key; title?; layout? }` — `layout` is `grid`·`row`·`fill` |
| `head` | `boolean?` | `head:false` → full-bleed (no band) |

**Handle.** `SurfaceHandle` adds `section(key: string): HTMLElement | null` — the
host a page mounts a section's content into. `SurfaceUpdate = { title?; meta? }`.
Composes `atoms.button`.

## `renderMarkdown`
```ts
renderMarkdown(text?: string): HTMLElement   // returns a .amu-md node, no host
```
**Purpose.** A SAFE, minimal Markdown → DOM renderer. Builds DOM nodes (every text
run via a text node → auto-escaped), never `innerHTML` of user content and never
raw-HTML passthrough — so `<script>…</script>` renders as literal text. Links are
scheme-checked (http/https/mailto) and open in a new tab (`rel=noopener`).
**Notes.** A function, not a mount — append the returned node yourself. Supports
paragraphs, `**bold**`, `*italic*`, `` `code` ``, fenced code, `>` quote, `-`/`1.`
lists, `[label](url)` links.

## `mountUploader`
```ts
mountUploader(host: Element, cfg: UploaderCfg): UploaderHandle
```
A drop-zone + picker (single `onFile`, or `multiple:true` + `onFiles`).
**Config (`UploaderCfg`).** `{ label?; hint?; accept?; multiple?; onFile?(file); onFiles?(files) }`
(`accept` default `".csv,.tsv,.txt"`).
**Handle.** `UploaderHandle` adds `busy(on: boolean, msg?: string): void` (disables
the input while in-flight; shows `atoms.spinner`). Supports click, keyboard, and
drag-and-drop; clears the input value after each pick.

## `mountScoreBadge`
```ts
mountScoreBadge(host: Element, cfg: ScoreBadgeCfg): MountHandle<ScoreBadgeUpdate>
```
A 0–100 headline pill with a click-open breakdown popover.
`ScoreBadgeCfg = { score?; report? }`. Tone derives from the score (≥90 ok, ≥70
warn, else danger). Without a `report` the pill is disabled. `ScoreBadgeUpdate =
Partial<ScoreBadgeCfg>`.

## `mountSidePanel`
```ts
mountSidePanel(host: Element, cfg: SidePanelCfg): SidePanelHandle
```
**Purpose.** A tabbed, collapsible INLINE panel: a tab strip + a collapse
affordance + a body that lazily mounts the active tab on first show (cached).
**Config (`SidePanelCfg`).** `{ side?: "left"|"right"; tabs?: SidePanelTab[]; active?; collapsed?; onTab?(id); onToggle?(open) }`,
where `SidePanelTab = { id; label; icon?; mount?(bodyHost): MountHandle | void }`.
**Handle.** `SidePanelHandle` adds `body(id)`, `setActive(id)`, `setOpen(open)`,
`toggle()`, `tab(id): MountHandle | null`. `destroy()` tears down every cached tab
handle. Composes `atoms.button`.

## `mountDashboardGrid`
```ts
mountDashboardGrid(host: Element, cfg: DashboardGridCfg = {}): DashboardGridHandle
```
**Purpose.** A designer canvas: a cols×rows grid (default 15×10) where each element
is placed by `{x,y,w,h}` cell coords. Editable mode adds drag-move + SE-resize
(snap to cells) + remove, firing `onLayoutChange` after each commit.
**Config (`DashboardGridCfg`).** `{ cols?; rows?; elements?: DashboardElement[]; editable?; onLayoutChange?(layout); onRemove?(id) }`,
where `DashboardElement = { id; x; y; w; h; mount?(body): MountHandle | void }`.
**Handle.** `DashboardGridHandle` adds `getLayout()`, `addElement(e)`,
`removeElement(id)`, `setEditable(next)`. `DashboardGridUpdate = { elements? }`.

## `mountGridToolbar`
```ts
mountGridToolbar<S = ToolbarState>(host: Element, cfg: GridToolbarCfg<S>): GridToolbarHandle<S>
```
**Purpose.** A DATA-DRIVEN control strip: a spec of controls it renders, running
ONE delegated handler and reporting every action through `onAction(id, ctx)`. It
holds no behavior — the consumer owns mutual-exclusion etc. and reflects state via
`setActive`/`setDisabled`.
**Config (`GridToolbarCfg<S>`).** `{ controls?: ControlSpec<S>[]; onAction?(id, ctx); state?: S }`.
`ControlSpec` is a `kind`-tagged union: `search` · `button` · `toggle` · `menu` ·
`chip` · `sep`. `ActionCtx = { value?; menu? }`.
**Handle.** `GridToolbarHandle` adds `setActive(id, on)`, `setDisabled(id, off)`.
`GridToolbarUpdate<S> = { state?; controls? }`. Composes `atoms.button` +
`mountMenu` + `atoms.input`; a promise-returning `onAction` spins the button's icon.

## `mountReportBuilder`
```ts
mountReportBuilder(host: Element, cfg: ReportBuilderCfg): MountHandle<ReportBuilderUpdate>
```
**Purpose.** A product-agnostic "show me [measure] for each [breakdown]" form — it
knows nothing about files/endpoints; it takes columns + an aggregation vocabulary
and emits builder state on Run.
**Config (`ReportBuilderCfg`).** `{ columns?: {key,label?}[]; aggFns?: {value,label}[]; onRun?(state); onClear?() }`.
`onRun` receives `{ groupBy: string[]; measures: {col,fn}[] }`. `ReportBuilderUpdate
= { columns? }`. Composes `atoms.button` + `mountSelect`.

## `mountSettingsForm`
```ts
mountSettingsForm(host: Element, cfg: SettingsFormCfg): MountHandle<SettingsFormUpdate>
```
**Purpose.** Renders REGISTRATIONS (a pref/policy registry), never hand-written
forms — the "third framework": a knob registered anywhere appears here with zero
page edits.
**Config (`SettingsFormCfg`).** `{ defs: PrefDef[]; get(key): unknown; set(key, value): void }`.
Per-def control: `"select"` → `mountSelect`, `"toggle"` → checkbox, else
`atoms.input` (commits on Enter). `SettingsFormUpdate = { defs? }`. Pairs with
`pref-registry` (see [ARCHITECTURE §5](./ARCHITECTURE.md#5--the-registries)).

## `mountTabs`
```ts
mountTabs(host: Element, cfg: TabsCfg): MountHandle<TabsUpdate>
```
A calm view switcher. `underline` (default) is the quiet in-page switch;
`segmented` is a pill group. Controlled (`value`+`onChange`) or uncontrolled
(`defaultValue`).
**Config (`TabsCfg`).** `{ items: TabItem[]; value?; defaultValue?; onChange?(id); variant?: "underline"|"segmented"; block? }`,
`TabItem = { id; label: Child; icon?; count? }`. Renders `role="tablist"`;
selection reflected via `aria-selected` (no content panels managed). `TabsUpdate =
{ value? }`.

## `mountCode`
```ts
mountCode(host: Element, cfg: CodeCfg): MountHandle
```
Inline (`<code>`, default) or block (`<pre>` when `block:true`) monospace snippet.
`CodeCfg = { text: string; block?; tone?: "default"|"accent"|"muted"; truncate? }`.
Snippet text is always a text node (no HTML injection).

## `mountKindLabel`
```ts
mountKindLabel(host: Element, cfg: KindLabelCfg = {}): MountHandle
```
A datatable-header type tag. `KindLabelCfg = { kind?: "Int"|"Float"|"Bool"|"Text";
variant?: "text"|"chip" }` (defaults `Text` / `text`).

---

## COMPOSED tier

Layout/theme only — reads tokens, no service. A COMPOSED component imports the LEAF
atoms it needs; it never re-implements one.

## `mountChart`
```ts
mountChart(host: Element, cfg: ChartTileCfg = {}): ChartTileHandle
```
**Purpose.** A card with an optional title above a fixed-height ECharts mount slot.
With an `option` + `window.echarts` present it mounts a chart; with neither it
renders a faded placeholder — never blanks the page, never throws, never logs.
ECharts is read off `window.echarts`; this component never imports it.
**Config (`ChartTileCfg`).** `{ title?; option?: unknown; theme?: string; id? }`.
**Handle.** `ChartTileHandle` adds `canvas`, `chart` (a getter tracking the live
instance), `resize()`, `setOption(opt)`, `dispose()`.
**Notes.** The SOLE component that subscribes to `onThemeChange`: because ECharts
binds its theme at `init(canvas, theme)` (not setOption-mutable), the reaction
disposes and re-inits with the freshly re-resolved theme, then re-applies the held
option. Subscription + resize listener are torn down in `dispose()`/`destroy()`.
Sub-files (`chart/theme.ts`, `build.ts`, `render.ts`) export `chartTheme()`
(maps `html[data-mode]` → a chart-theme name), `configureChartThemes({load})`
(inject a theme-JSON `Source`), `ensureRegisteredThemes()`, `buildOption`,
`renderChart`, `synthesizeOption`.

## `mountFilterPanel`
```ts
mountFilterPanel(host: Element, cfg: FilterPanelCfg): MountHandle<FilterPanelUpdate>
```
**Purpose.** A ~280px side-panel builder for the shared `FilterNode` tree; all
node↔row logic is the pure `filter-node.ts` (unit-testable without a DOM).
**Config (`FilterPanelCfg`).** `{ columns?: {key,label?}[]; value?: FilterNode | null; onApply?(node); onClear?() }`.
Nesting capped at depth 2. `FilterPanelUpdate = { columns?; value? }`. Composes
`atoms.button`/`input` + `mountSelect`.
**Sub-file `filter-node.ts`** — the PURE algebra (no DOM, no imports): a `Group
{ node:"group", op:"and"|"or", children }` / `Pred { node:"pred", col, op, value?,
case_sensitive? }` shape (empty Group = match-all). Exports `assembleFilter(rows,
combinator)`, `decomposeFilter(node)`, `evalFilter(node, row)` (mirrors server/wasm
PredOp semantics), plus `rowComplete`, `blankRow`, `isEmptyFilter`, and the op sets
`PRED_OPS`/`VALUELESS_OPS`/`RANGE_OPS`/`LIST_OPS`.

## `mountGridView`
```ts
mountGridView<S = ToolbarState>(host: Element, cfg: GridViewCfg<S>): GridViewHandle<S>
```
**Purpose.** A thin composer stacking an optional `grid-toolbar` above a `redtable`
(with an optional arbitrary `sheet` node between). Owns no behavior; omit `toolbar`
and it's just the table.
**Config (`GridViewCfg<S>`).** `{ toolbar?: GridToolbarCfg<S>; table?: RedTableCfg; sheet?: Node | null }`.
**Handle.** `GridViewHandle` adds `table: RedTableHandle`, `toolbar:
GridToolbarHandle<S> | null`, `setSheet(node)`. `update` fans out: `rows`/`columns`
→ `table.update`, `state` → `toolbar.update`.

## `mountRedTable`
```ts
mountRedTable(host: Element, cfg: RedTableCfg): RedTableHandle
```
**Purpose.** THE data table — one implementation where **virtual** and **pager**
are config on the same component, along two independent axes: `mode` (layout: how
many rows render) and `interaction` (behavior: what a click does). Selection lives
in closure state keyed by `rowKey`, never on recycled DOM. Throws only if `rowKey`
isn't a function.
**Config (`RedTableCfg`).**
| field | type | meaning |
|---|---|---|
| `columns` | `RedTableColumn[]` | `{ key; label?; dtype?; editor? }`; `int`/`float` right-align + are the default editor key |
| `rows` | `RedTableRow[]?` | row objects, keyed by column key |
| `rowKey` | `(row) => string` | **REQUIRED** — a row's stable identity |
| `mode` | `"auto"\|"virtual"\|"pager"?` | `auto` → virtual above 200 rows, else pager |
| `pageSize` | `number?` | pager page size (default 50) |
| `interaction` | `"browse"\|"select"\|"edit"\|"delete"?` | click behavior |
| `onRowClick` | `(row, key) => void?` | every row click, any interaction |
| `onSelectChange` | `(keys) => void?` | selection changed |
| `onRowDelete` | `(key) => void?` | delete interaction |
| `onCellCommit` | `(rowKey, colKey, value) => void?` | edit interaction |
| `sortable` | `boolean?` | clickable headers → `onSort(col)` |
| `sort` | `RedTableSort \| null?` | active sort `{ col; descending? }` (drives the chevron) |
| `onSort` | `(col) => void?` | header clicked; consumer owns asc→desc→off + reflects via `update({sort})` |
| `rowNumbers` | `boolean?` | a leading #-column |
| `empty` | `EmptyStateCfg?` | empty-state config |
| `editorFor` | `(col) => EditorFactory?` | INJECTED editor resolver (defaults to the registry) |

**Handle.** `RedTableHandle` adds `selection(): string[]`, `clearSelection()`,
`setInteraction(m)`. `RedTableUpdate = { rows?; columns?; sort?; rowNumbers? }` (a
`rows` change resets to page 1 and prunes orphaned selection). Composes `mountPager`
+ `mountEmptyState` + the virtual-rows windowing.
**Sub-files.** `virtual-rows.ts` keeps ~40 `<tr>` in the DOM with computed-height
spacers (`createVirtualRows` → `repaint()`/`setCount(n)`/`destroy()`).
`editor-registry.ts` is the default cell-editor index — `registerEditor(dtype,
factory)` + `defaultEditorFor(col)`; a factory takes over the `<td>`, commits on
blur/Enter, reverts on Escape (built-ins: text/int/float).

## `mountColumnManager`
```ts
mountColumnManager(host: Element, cfg: ColumnManagerCfg): MountHandle<ColumnManagerUpdate>
```
**Purpose.** A per-column cleaning surface: a column multi-select + a clean-op
palette, with an inline action-sheet for ops that take params. Ops are consumer
DATA — the component reads only generic `id/label/icon/scope/min/max/fields` and
emits `onApply`, so it depends on no page module.
**Config (`ColumnManagerCfg`).** `{ columns?: {key,label?}[]; ops?: CleanOp[]; onApply?(op, cols, values) }`.
Ops with no `fields` apply immediately; ops with fields open the sheet.
`ColumnManagerUpdate = { columns? }`. Composes `atoms.button`/`input` + `mountField`
+ `mountSelect`.

## `mountJoinsWizard`
```ts
mountJoinsWizard(host: Element, cfg: JoinsWizardCfg): MountHandle
```
**Purpose.** The multi-file join flow (detect → pick file/key → execute). Renders
into `host` (never opens its own modal) and owns its markup.
**Config (`JoinsWizardCfg`).** `{ detect?(): Promise<DetectResult>; onExecute?(body): Promise<unknown>; onCancel?() }`.
`JoinExecuteBody = { other_file, left_keys, right_keys, join_type, materialize_as? }`
(keys are arrays so multi-key joins extend cleanly). Composes
`atoms.button`/`input`/`chip`/`spinner` + `mountSelect` + `mountEmptyState`.

## `mountSqlEditor`
```ts
mountSqlEditor(host: Element, cfg: SqlEditorCfg): SqlEditorHandle
```
**Purpose.** A SQL console over the open file (as table `t`): Run + "Save as file"
(materialize) + an inline status line. Engine-agnostic — the consumer wires
`onRun`/`onMaterialize` to its data seam.
**Config (`SqlEditorCfg`).** `{ value?; suggestName?(): string; onRun?(query): Promise<unknown>; onMaterialize?(query, name): Promise<unknown> }`.
**Handle.** `SqlEditorHandle` adds `query(): string`. CSS knob:
`--sqleditor-input-min-h` (textarea min-height, default `8rem`).

## `mountStepsPanel`
```ts
mountStepsPanel(host: Element, cfg: StepsPanelCfg): MountHandle<StepsPanelUpdate>
```
**Purpose.** A cleaning history + undo/redo. Canonical view = base + replay of
applied steps; undo is a flag flip (undone steps get `is-undone`).
**Config (`StepsPanelCfg`).** `{ steps?: CleaningStep[]; canUndo?; canRedo?; onUndo?(); onRedo?() }`.
`StepsPanelUpdate = Partial<StepsPanelCfg>` (so `canUndo`/`canRedo` re-toggle the
buttons live). Composes `atoms.button`.

## `mountWorkspacePanels`
```ts
mountWorkspacePanels(host: Element): WorkspacePanelsHandle
```
**Purpose.** A responsive 3-region frame (left/center/right). It owns the
responsive `@media` + side-drawer behavior (off-canvas + scrim, matchMedia-driven,
classList only) and returns the three region hosts; it knows nothing of their
content. Takes **no cfg**.
**Handle.** `WorkspacePanelsHandle` adds `left`, `center`, `right: HTMLElement`,
`togglePanel(side)`, `setPanelOpen(side, want)`, `isOpen(side)`
(`PanelSide = "left"|"right"`). At ≥80rem the regions are a grid; below, center is
the single column and left/right are off-canvas drawers. CSS knobs:
`--wsp-left-w` / `--wsp-right-w` (default `18rem`).

## `mountTopbar`
```ts
mountTopbar(host: Element, cfg: TopbarCfg = {}): TopbarHandle
```
**Purpose.** A slim pure-navigation topbar: a sidebar toggle, a centred search
slot, per-page nav icons, and an optional app launcher. RBAC-agnostic; no hardcoded
app registry (nav is injected; search is an optional injected element/mount).
**Config (`TopbarCfg`).** `{ nav?: { items: [{id,label,icon?,href?}], active? }; onToggleRail?(); search?: Node | ((slot) => MountHandle | void); apps?: { items; onSelect?; title? } }`.
**Handle.** `TopbarHandle` adds `setActive(id)`. Composes `atoms.button` +
`mountMenu`.

## `mountRail`
```ts
mountRail(host: Element, config: RailConfig = {}): RailHandle
```
**Purpose.** The page's left navigation: a data-driven two-level group/tab strip (a
group = a container like a project; a tab = a leaf like a file). UI only — zero
fetch; every interaction is reported through `config.on` callbacks.
**Config (`RailConfig`).**
| field | type | meaning |
|---|---|---|
| `title` | `string?` | declared, not rendered (page name lives in the topbar) |
| `collapsed` | `boolean?` | start in the compact icon-rail |
| `search` | `RailSearchCfg?` | `{ placeholder?; onInput?(q) }` filter box |
| `overview` | `RailOverviewCfg?` | a pinned pseudo-tab above the groups |
| `groups` | `RailGroupData[]?` | the group/tab tree |
| `hidden` | `RailHiddenSection[]?` | the "Hidden (N)" restore drawer |
| `footer` | `RailFooterCfg?` | `{ create?; universals? }` |
| `on` | `RailHandlers?` | the interaction callbacks (below) |

`RailGroupData = { id?; name?; mark?; initials?; count?; collapsed?; renamable?;
hidable?; addLabel?; tabs?: RailTab[] }`; `RailTab = { id?; name?; icon?; dot?;
active?; renamable?; hidable?; title?; actions? }`. `on` = `tab(tabId, groupId)`,
`tabRename`, `tabHide`, `groupToggle`, `groupRename`, `groupHide`, `groupAdd`,
`overview`, `restore`, `create`, `theme`, `settings`, `signOut`, `profile`,
`collapseToggle`, and `custom?: Record<string, handler>` (a tab's custom `action`
dispatches by name through `on.custom[action]`).
**Handle.** `RailHandle` adds `setGroups(groups, hidden?, emptyText?)`,
`setActive(id)`, `toggleCollapse(want?): boolean` (below 64rem drives a transient
off-canvas drawer; above, the persisted `.compact` icon-rail). One delegated click
handler routed by `data-rail-action` (survives the body re-render). Companion
controller: [`rail-data`](#mountraildata).

## `mountTermbar`
```ts
mountTermbar(host: Element, cfg: TermbarCfg): MountHandle<TermbarUpdate>
```
**Purpose.** The Console top strip: three traffic-light dots + the "doumouya"
wordmark + the per-app cwd + a status pill + a light/dark toggle.
**Config (`TermbarCfg`).** `{ cwd: string; status?: string }` (status default
`"● client-side"`). `TermbarUpdate = { cwd?; status? }`.
**Notes.** Wired to `theme.ts`: the toggle calls `toggleMode()`, reads `getMode()`
to label `☀ light` / `☾ dark`, and subscribes via `onThemeChange` so the label
stays in sync when the mode flips elsewhere (unsubscribe in `destroy()`).

---

## DATA tier

Service-coupled — but only through an **injected** seam (a `Service`, a `Source`,
or `onAction`/`onChange` callbacks). Never a hardwired transport. Each paints
optimistically and reverts on failure
([ARCHITECTURE §6](./ARCHITECTURE.md#6--data-flow-through-a-data-component)).

### Seam types

From [`src/contract/service.ts`](../src/contract/service.ts):

```ts
export interface ServiceError extends Error { status: number; body?: unknown; }

export interface Service {
  get<T>(path: string, opts?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  upload<T>(path: string, file: File | FormData): Promise<T>;
}

// A read-only async data source — a query in, typed rows out.
export type Source<T> = (query?: Record<string, unknown>) => Promise<T>;
```

## `mountPermCell`
```ts
mountPermCell(host: Element, cfg: PermCellCfg = {}): MountHandle<PermCellUpdate>
```
**Purpose.** A single RBAC-matrix cell; one click cycles the tier's access through
a config-driven `order` (default `["", "r", "rw"]`). PURE — holds no matrix, fetches
nothing. Paints optimistically, reports the next value via `onChange`, reverts on
failure via `update({ value })`.
**Config (`PermCellCfg`).**
| field | type | meaning |
|---|---|---|
| `value` | `string?` | current tier (must be in `order`) |
| `order` | `readonly string[]?` | cycle order; default `["", "r", "rw"]` |
| `labels` | `Record<string,string>?` | per-value cell text (falls back to the value) |
| `titles` | `Record<string,string>?` | per-value tooltip / aria-label |
| `cap` | `string?` | the CEILING tier reachable by cycling; `cap = order[0]` ⇒ a permanently-locked guardrail |
| `onChange` | `(next: string) => void?` | the persistence callback |

**Seam.** `onChange(next)` (persistence) + the config `order`.
**Handle.** `PermCellUpdate = { value? }` (the revert). Also exports
`DEFAULT_PERM_ORDER`. A locked cell stamps `data-locked="1"` and no-ops clicks;
state rides `data-perm`.

## `mountOmni`
```ts
mountOmni(host: Element, cfg: OmniCfg): OmniHandle
```
**Purpose.** A search pill + results dropdown; a result carries a ready
`hash`/`href` the consumer routes to. Ctrl/Cmd-K focuses it (bound once for the
app's life); keyboard nav, 200ms debounce, abortable.
**Config (`OmniCfg`).**
| field | type | meaning |
|---|---|---|
| `source` | `Source<OmniResult[]>` | **required** — `source({ q, limit, signal })` → results |
| `onSelect` | `(result) => void?` | a result chosen (routes to `result.hash`/`href`) |
| `kinds` | `Record<string, { label?; icon? }>?` | per-kind label + icon |
| `placeholder` | `string?` | input placeholder (default `"Search…"`) |
| `limit` | `number?` | max results requested (default 20) |

`OmniResult = { kind; label; sub?; hash?; href?; id? }`.
**Seam.** The injected `cfg.source` (reach-scoped search).
**Handle.** `OmniHandle` adds `focus()`. Highlight is built from text nodes (no
`innerHTML`); selection uses `mousedown` (before blur).

## `mountMessageThread`
```ts
mountMessageThread(host: Element, cfg: MessageThreadCfg): MountHandle
```
**Purpose.** A message feed (each body through the SAFE markdown renderer) + a
Markdown composer (textarea + Write/Preview + a formatting toolbar + Send). While
mounted it POLLS the injected source for new messages.
**Config (`MessageThreadCfg`).**
| field | type | meaning |
|---|---|---|
| `source` | `Source<Message[]>` | **required** — `source({ after })` → new messages since the cursor |
| `send` | `(text: string) => Promise<Message>` | **required** — send a body; resolves to the created message |
| `onRead` | `(at: string) => void?` | mark read up to the latest cursor |
| `pollMs` | `number?` | poll interval (default 4000) |
| `emptyTitle` / `emptyLine` / `placeholder` | `string?` | copy overrides |

`Message = { id?; author?; at?; body? }` (`at` = the ISO poll cursor; `body` =
Markdown text).
**Seam.** Feed via `cfg.source` (polled with `{ after }`); send via `cfg.send`.
**Notes.** Poll dedup via a `seen` id-set. A poll error keeps the prior feed and
shows a transient refresh-error banner — it never paints the empty-state over live
messages.

## `mountChartEditor`
```ts
mountChartEditor(host: Element, cfg: ChartEditorCfg): ChartEditorHandle
```
**Purpose.** Pick a source file + group-by + measure + chart type + theme and see a
LIVE preview. Holds the chart cfg; `getPayload()` returns the persistable recipe
(the chart definition MINUS the baked option — the option carries aggregated data
and is re-derived on render, never persisted).
**Config (`ChartEditorCfg`).**
| field | type | meaning |
|---|---|---|
| `files` | `ChartEditorFile[]?` | selectable source files `{ rid; filename }` |
| `columns` | `Source<string[]>` | **required** — `columns({ fileId })` → column names |
| `preview` | `Source<unknown[][]>` | **required** — `preview({ fileId, groupBy, aggCol, aggFn })` → rows |
| `initial` | `ChartEditorInitial?` | seed when editing |
| `aggFns` | `AggFn[]?` | measure functions (default count/sum/mean/min/max/distinct) |
| `onChange` | `(recipe) => void?` | after every successful preview |
| `onError` | `(err) => void?` | a columns/preview REJECT (not a stale/aborted preview) |

**Seam.** `cfg.columns` + `cfg.preview` (both injected `Source`s).
**Handle.** `ChartEditorHandle` adds `getPayload()`, `getOption()`, `valid()`.
Re-themes via `onThemeChange` unless the user pins a theme; renders via
`renderChart`/`synthesizeOption` (graceful no-op without `window.echarts`).

## `mountRailData`
```ts
mountRailData(host: Element, config: RailDataConfig): RailDataHandle
```
**Purpose.** The controller behind the rail: wraps [`mountRail`](#mountrail) with a
data layer + universal footer actions, and layers local view state the data tree
doesn't carry (per-user hide set + restore drawer, a client-side name filter,
deterministic initials marks).
**Config (`RailDataConfig`).** the load seam + injected callbacks:
| field | type | meaning |
|---|---|---|
| `load` / `source` | `Source<RailTree>?` | the injected async loader (one of the two) |
| `query` | `Record<string,unknown>?` | passed to the loader |
| `active` | `string?` | active tab id |
| `onNavigate` | `(tab: RailNavTab) => void?` | a tab click (consumer routes by `tab.kind`) |
| `onAction` | `(action, tabId?, groupId?) => void?` | generic action passthrough |
| `onRename` | `(kind: "project"\|"file", id?, value) => void?` | inline rename commit |
| `onTheme` / `onNavigateUniversal` / `onSignOut` | callbacks | the universal footer actions |
| `persist` | `(key, value) => void?` | persist collapse + hidden state |
| `collapsed` / `hidden` | `boolean` / `string[]?` | consumer-read initial UI state |

**Seam.** Tree via `config.load`/`source`; rename via `onRename`; nav/theme/etc. via
the injected callbacks; persistence via `persist`. No `location.hash` hardwire, no
fetch.
**Handle.** `RailDataHandle` adds `refresh()` (re-pull in place); `setActive(id)`
comes from the wrapped `RailHandle`. Has NO css of its own (rail owns `.amu-rail*`).

## `mountObjectList`
```ts
mountObjectList(host: Element, cfg: ObjectListConfig)   // handle: { el, update, current, destroy }
```
**Purpose.** THE generic object-table body: given an object type, it renders that
type's list with zero per-type code — columns DERIVE from the type registry (over
the Service seam), rows from the injected source, CRUD through `onAction`.
`update({ type })` switches the type.
**Config (`ObjectListConfig`).**
| field | type | meaning |
|---|---|---|
| `type` | `string?` | the active object type id |
| `types` | `Service \| Source<TypeDef[]>?` | the type catalogue (→ type-registry) |
| `source` | `(type) => Promise<{items?} \| ObjRow[]>?` | the row loader |
| `columns` | `{ key; label? }[]?` | column override (else derived) |
| `onOpen` | `(row) => void?` | browse-mode row click |
| `onAction` | `(a: ObjectAction) => Promise<unknown>?` | create/edit/delete write |
| `create` | `{ label?; onCreate? }?` | injected create-flow override |
| `readOnly` | `string[]?` | config read-only type ids |
| `required` | `Record<string, string[]>?` | required-field keys per type |
| `pluralOf` | `Record<string, string>?` | plural display name per type |

`ObjectAction = { kind: "create"|"edit"|"delete"; type; rid?; data? }`.
**Seam.** Rows via `cfg.source(type)`; catalogue via `cfg.types`; writes via
`cfg.onAction`.
**Handle.** `update(p?: { type?; filter?: FilterNode | null })` and
`current(): string | null`. Composes [`mountGridView`](#mountgridview) (search ·
filter · edit/select/delete · refresh · row-numbers · columns · download);
filter + search run client-side. `PAGE_SIZES = [25, 50, 100, 500]`.

---

## Engine (optional)

The lazy, injected-wasm-path data layer under [`src/engine/`](../src/engine/). No
CSS, ships no wasm binary; with no path + no callbacks it degrades to empty/null —
no throw, no log. Nothing else depends on it.

### `configureEngine` / `getEngine`
```ts
configureEngine(cfg: EngineConfig = {}): void            // { wasmPath?; load? }
getEngine(): Promise<WasmEngine | null>
clientParseScore(bytes): Promise<unknown>
loadWorkbook(bytes, tld?): Promise<unknown>
```
The lazy loader: cold visitors pay zero bytes; the first call dynamically imports +
initialises the wasm-bindgen module and introspects its exports at runtime. The
wasm path is **injected** via `configureEngine({ wasmPath, load? })` — never a
hardcoded path. `configureEngine` is idempotent (re-config resets the cache).
Graceful: with no path, `getEngine()` resolves `null` and the helpers return `null`.

### `serverSource` / `clientSource` / `pickSource`
```ts
serverSource(cfg: ServerSourceCfg = {}): WindowSource
clientSource(cfg: ClientSourceCfg = {}): WindowSource
pickSource(cfg: PickSourceCfg = {}): WindowSource
```
The pluggable WINDOW behind the grid — one `WindowSource` interface, two sources
(server / resident-wasm client), the same `QuerySpec`. The grid calls
`window()`/`score()` and never knows which. `serverSource` pages/sql/score via the
injected `window`/`sql`/`score` callbacks; `clientSource` reads a resident wasm
Workbook from injected `bytes`/`fetchBytes`; `pickSource` routes by a
`CELL_BUDGET = 12M` cells budget (client when it fits + configured, else server).
All degrade to `EMPTY_PAGE` / `null` when nothing is wired.

`WindowSource = { kind: "server"|"client"; ready: Promise<void>; window(spec,
offset, limit); sql(query); score(); destroy() }`.
