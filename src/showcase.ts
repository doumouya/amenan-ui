/* showcase.ts — AC-K1. The specimen gallery: it mounts EVERY ported component
   into `#app` as a labeled section, standalone, with NO network. The data/RBAC-
   coupled components (omni, object-list, message-thread, chart-editor, rail-data)
   are fed MOCK injected sources/callbacks through the Service/Source seam, so they
   render fully without a backend. The chart family renders a real ECharts tile
   when `window.echarts` (the vendored echarts.min.js) is present, and the empty
   placeholder otherwise — never throwing either way. The engine modules
   (wasm-engine/window-source) demo the graceful no-wasm path (clean empty state).

   A header theme toggle proves the dark/light contract via theme.ts. Every
   component is also `register()`ed (its mount wrapped through `toMount` where it
   returns a raw Node) and `listComponents()` is enumerated to exercise the
   registry — proving the registry seam composes the same surface the gallery
   mounts by hand.

   This module is the SHOWCASE only — it imports the public barrel (src/index.ts)
   and never reaches a transport. esbuild bundles it to dist/showcase.js. */

import {
  // kernel + foundation
  el,
  getTheme,
  getMode,
  setMode,
  toggleMode,
  register,
  listComponents,
  toMount,
  type Source,
  // atoms
  button,
  chip,
  input,
  textarea,
  badge,
  spinner,
  kbd,
  // leaf components (W3)
  mountCard,
  mountEmptyState,
  openModal,
  confirmModal,
  mountMenu,
  mountSelect,
  toast,
  mountStat,
  mountStatStrip,
  mountField,
  mountChipRow,
  mountPager,
  mountSurface,
  renderMarkdown,
  mountUploader,
  mountScoreBadge,
  mountSidePanel,
  mountDashboardGrid,
  mountGridToolbar,
  mountReportBuilder,
  mountSettingsForm,
  type PrefDef,
  // composed / layout (W4)
  mountChart,
  buildOption,
  synthesizeOption,
  THEMES,
  mountFilterPanel,
  assembleFilter,
  mountColumnManager,
  mountJoinsWizard,
  mountSqlEditor,
  mountStepsPanel,
  mountWorkspacePanels,
  mountRedTable,
  mountGridView,
  mountTopbar,
  mountRail,
  // data / RBAC-coupled (W5)
  mountPermCell,
  mountOmni,
  type OmniResult,
  mountMessageThread,
  type Message,
  mountChartEditor,
  mountRailData,
  mountObjectList,
  type TypeDef,
  // engine (W5b, optional/graceful)
  configureEngine,
  getEngine,
  pickSource,
} from "./index.ts";

/* ── gallery scaffolding ────────────────────────────────────────────────── */

const app = document.querySelector("#app");
if (!app) throw new Error("showcase: #app host not found");

/** A labeled specimen section. `note` documents the seam being demonstrated. */
function section(title: string, note?: string): HTMLElement {
  const card = el(
    "section",
    { class: "amu-showcase-spec" },
    el("h2", { class: "amu-showcase-spec-title" }, title),
    note ? el("p", { class: "amu-showcase-spec-note" }, note) : null,
  );
  const body = el("div", { class: "amu-showcase-spec-body" });
  card.append(body);
  app!.appendChild(card);
  return body;
}

/** A small inline label above a single specimen. */
function row(host: Element, label: string): HTMLElement {
  const r = el("div", { class: "amu-showcase-row" }, el("span", { class: "amu-showcase-row-label" }, label));
  const slot = el("div", { class: "amu-showcase-row-slot" });
  r.append(slot);
  host.appendChild(r);
  return slot;
}

/* The registry-exercise log (AC-K1 optional): every specimen is also registered
   as a Component, then listComponents() proves the registry round-trips them. */
const registered: string[] = [];
function reg(name: string, factory: () => Node): void {
  register(name, toMount(factory));
  registered.push(name);
}

/* ── header: title + theme toggle (proves dark/light via theme.ts) ──────── */

function mountHeader(): void {
  const header = el("header", { class: "amu-showcase-header" });
  header.append(el("h1", { class: "amu-showcase-h1" }, "amenan-ui — component showcase"));

  const label = el("span", { class: "amu-showcase-theme-label" }, `${getTheme()} · ${getMode()}`);
  const toggleBtn = button({
    label: "Toggle mode",
    icon: "bi-circle-half",
    onClick: () => {
      toggleMode();
      label.textContent = `${getTheme()} · ${getMode()}`;
    },
  });
  const controls = el("div", { class: "amu-showcase-controls" }, toggleBtn, label);
  header.append(controls);
  app!.appendChild(header);
}

/* ── mock sources (the Service/Source seam — in-memory, zero network) ────── */

const SAMPLE_ROWS = Array.from({ length: 8 }, (_, i) => ({
  rid: `FILE_${1000 + i}`,
  name: `sample-${i + 1}.csv`,
  rows: 100 * (i + 1),
  cleanliness: 70 + i * 3,
}));

const MOCK_TYPES: TypeDef[] = [
  {
    type_id: "file",
    display_name: "File",
    is_builtin: true,
    fields: [
      { key: "name", label: "Name", data_type: "text", perm_class: "editable" },
      { key: "rows", label: "Rows", data_type: "int", perm_class: "readonly" },
      { key: "cleanliness", label: "Score", data_type: "int", perm_class: "readonly" },
    ],
  },
];

/** A Source<TypeDef[]> — the type catalogue, in memory. */
const typesSource: Source<TypeDef[]> = () => Promise.resolve(MOCK_TYPES);

/** A Source<OmniResult[]> — local fuzzy match over the sample rows. */
const omniSource: Source<OmniResult[]> = (q) => {
  const term = String((q?.["q"] as string | undefined) ?? "").toLowerCase();
  const hits: OmniResult[] = SAMPLE_ROWS.filter((r) => r.name.toLowerCase().includes(term)).map((r) => ({
    kind: "file",
    label: r.name,
    sub: `${r.rows} rows`,
    id: r.rid,
  }));
  return Promise.resolve(hits);
};

/** A Source<Message[]> for the thread — a fixed feed, no cursor advance. */
let threadDelivered = false;
const threadSource: Source<Message[]> = () => {
  if (threadDelivered) return Promise.resolve([]);
  threadDelivered = true;
  return Promise.resolve([
    { id: "m1", author: "USER_ana", at: "2026-06-30T09:00:00Z", body: "First pass on **cleanliness** looks good." },
    { id: "m2", author: "USER_bo", at: "2026-06-30T09:05:00Z", body: "Agreed — see the `score` column." },
  ]);
};

/* ── leaf tier (W3) ──────────────────────────────────────────────────────── */

function showcaseLeaf(): void {
  // atoms
  const atoms = section("atoms", "LEAF — pure DOM builders (button/chip/input/textarea/badge/spinner/kbd).");
  const aslot = row(atoms, "buttons");
  aslot.append(
    button({ label: "Accent", variant: "accent", onClick: () => toast({ message: "clicked" }) }),
    button({ label: "Ghost", variant: "ghost" }),
    button({ label: "Danger", variant: "danger" }),
    button({ icon: "bi-gear", title: "Icon-only", ariaLabel: "settings" }),
  );
  reg("atoms.button", () => button({ label: "Registered" }));
  const cslot = row(atoms, "chips");
  cslot.append(chip({ label: "draft" }), chip({ label: "active", active: true }));
  const islot = row(atoms, "inputs");
  islot.append(input({ placeholder: "text input" }), textarea({ placeholder: "textarea" }));
  const bslot = row(atoms, "badge / spinner / kbd");
  bslot.append(badge({ label: "info", tone: "info" }), badge({ label: "ok", tone: "ok" }), spinner(), kbd("Ctrl"), kbd("K"));

  // card
  const cards = section("card", "LEAF — content tile.");
  mountCard(row(cards, "card"), { title: "Sample file", sub: "100 rows · 88% clean" });
  reg("card", () => {
    const h = el("div");
    mountCard(h, { title: "Registered card" });
    return h;
  });

  // empty-state
  const empty = section("empty-state", "LEAF — onboarding empty state with one action.");
  mountEmptyState(row(empty, "empty"), {
    title: "No files yet",
    line: "Upload a CSV to get a cleanliness score.",
    action: { label: "Upload", onClick: () => toast({ message: "upload" }) },
  });
  reg("empty-state", () => {
    const h = el("div");
    mountEmptyState(h, { title: "Empty", line: "Nothing here." });
    return h;
  });

  // modal (openModal/confirmModal) — buttons that summon them
  const modal = section("modal", "LEAF — openModal / confirmModal (overlay; click to summon).");
  const mslot = row(modal, "modal triggers");
  mslot.append(
    button({
      label: "Open modal",
      onClick: () =>
        openModal({
          title: "Create file",
          body: "A create form would live here.",
          actions: [{ label: "Cancel", variant: "ghost", onClick: (api) => api.close() }, { label: "Create", variant: "accent", onClick: (api) => api.close() }],
        }),
    }),
    button({
      label: "Confirm",
      variant: "danger",
      onClick: () => void confirmModal({ title: "Delete?", message: "This cannot be undone.", danger: true }),
    }),
  );

  // menu
  const menu = section("menu", "LEAF — delegated dropdown.");
  const trigger = button({ label: "Menu", icon: "bi-three-dots" });
  const mh = row(menu, "menu");
  mh.append(trigger);
  mountMenu(mh, {
    trigger,
    items: [
      { label: "Files", heading: true },
      { label: "Open", icon: "bi-folder2-open", onSelect: () => toast({ message: "open" }) },
      { label: "Rename", icon: "bi-pencil", onSelect: () => toast({ message: "rename" }) },
      { sep: true },
      { label: "Delete", icon: "bi-trash3", onSelect: () => toast({ message: "delete" }) },
    ],
  });

  // select
  const select = section("select", "LEAF — native single-choice.");
  mountSelect(row(select, "select"), {
    options: [
      { value: "csv", label: "CSV" },
      { value: "tsv", label: "TSV" },
      { value: "json", label: "JSON" },
    ],
    value: "csv",
  });
  reg("select", () => {
    const h = el("div");
    mountSelect(h, { options: [{ value: "a", label: "A" }] });
    return h;
  });

  // toast
  const toasts = section("toast", "LEAF — transient feedback (the optimistic-UI partner).");
  row(toasts, "toast trigger").append(
    button({ label: "Show toast", onClick: () => toast({ message: "Saved", action: { label: "Undo", onClick: () => {} } }) }),
    button({ label: "Danger toast", variant: "danger", onClick: () => toast({ message: "Failed to save", tone: "danger" }) }),
  );

  // stat + stat strip
  const stat = section("stat", "LEAF — KPI tile + responsive strip.");
  mountStat(row(stat, "single"), { label: "Files", value: 42, tone: "ok", sub: "+3 today" });
  mountStatStrip(row(stat, "strip"), {
    stats: [
      { label: "Files", value: 42 },
      { label: "Avg score", value: "88%", tone: "ok" },
      { label: "At risk", value: 4, tone: "warn" },
    ],
  });

  // field
  const field = section("field", "LEAF — labeled form row wrapping any control.");
  mountField(row(field, "field"), { label: "File name", help: "Shown in the rail.", control: input({ value: "sample.csv" }) });

  // chip-row
  const chipRow = section("chip-row", "LEAF — single-select tabs over atoms.chip.");
  mountChipRow(row(chipRow, "chip-row"), {
    items: [
      { value: "all", label: "All" },
      { value: "clean", label: "Clean" },
      { value: "dirty", label: "Needs work" },
    ],
    value: "all",
  });

  // pager
  const pager = section("pager", "LEAF — page window + prev/next.");
  mountPager(row(pager, "pager"), { page: 2, pages: 9, total: 842 });

  // surface
  const surface = section("surface", "LEAF — content frame with a title band + section hosts.");
  const sh = row(surface, "surface");
  const surfHandle = mountSurface(sh, {
    title: "Workspace",
    meta: "842 rows",
    actions: [{ label: "Export", icon: "bi-download" }],
    sections: [{ key: "body", layout: "fill" }],
  });
  surfHandle.section("body")?.append(el("p", {}, "Section content mounts here."));

  // markdown (safe renderer)
  const md = section("markdown", "LEAF — SAFE markdown renderer (scheme-checked links, never innerHTML).");
  row(md, "markdown").append(
    renderMarkdown("# Heading\n\nA paragraph with **bold**, _italic_, `code`, and a [safe link](https://example.com).\n\n- one\n- two"),
  );

  // uploader
  const uploader = section("uploader", "LEAF — drop zone + picker.");
  mountUploader(row(uploader, "uploader"), {
    label: "Drop a CSV",
    hint: "or click to browse",
    accept: ".csv",
    onFile: (f) => toast({ message: `picked ${f.name}` }),
  });

  // score-badge
  const score = section("score-badge", "LEAF — cleanliness score with a click-open breakdown.");
  mountScoreBadge(row(score, "score"), {
    score: 88,
    report: { completeness: 95, type_consistency: 90, value_hygiene: 82, row_uniqueness: 99, structural: 1 },
  });

  // side-panel
  const side = section("side-panel", "LEAF — tabbed, collapsible inline panel.");
  const sph = row(side, "side-panel");
  sph.style.minHeight = "12rem";
  mountSidePanel(sph, {
    side: "right",
    tabs: [
      { id: "filter", label: "Filter", icon: "bi-funnel", mount: (b) => mountEmptyState(b, { title: "Filter", line: "Filter rows here." }) },
      { id: "steps", label: "Steps", icon: "bi-list-check", mount: (b) => mountEmptyState(b, { title: "Steps", line: "Cleaning history." }) },
    ],
    active: "filter",
  });

  // dashboard-grid
  const dash = section("dashboard-grid", "LEAF — placement canvas (view mode).");
  const dgh = row(dash, "dashboard-grid");
  dgh.style.minHeight = "16rem";
  mountDashboardGrid(dgh, {
    cols: 6,
    rows: 4,
    elements: [
      { id: "k1", x: 0, y: 0, w: 2, h: 1, mount: (b) => mountStat(b, { label: "Files", value: 42 }) },
      { id: "k2", x: 2, y: 0, w: 2, h: 1, mount: (b) => mountStat(b, { label: "Score", value: "88%", tone: "ok" }) },
    ],
  });

  // grid-toolbar
  const gtb = section("grid-toolbar", "LEAF — data-driven toolbar (search · toggles · menus).");
  mountGridToolbar(row(gtb, "toolbar"), {
    controls: [
      { kind: "search", id: "search", placeholder: "Search rows…" },
      { kind: "sep" },
      { kind: "toggle", id: "edit", icon: "bi-pencil", title: "Edit" },
      { kind: "button", id: "refresh", icon: "bi-arrow-clockwise", title: "Refresh" },
      { kind: "menu", id: "rows", icon: "bi-list-ol", title: "Rows", items: [{ id: "25", label: "25 rows" }, { id: "50", label: "50 rows" }] },
    ],
    onAction: (id) => toast({ message: `toolbar: ${id}` }),
  });

  // report-builder
  const rb = section("report-builder", "LEAF — the show-me-[measure]-for-each-[breakdown] form.");
  mountReportBuilder(row(rb, "report-builder"), {
    columns: [
      { key: "name", label: "Name" },
      { key: "rows", label: "Rows" },
      { key: "cleanliness", label: "Score" },
    ],
    aggFns: [
      { value: "count", label: "Count" },
      { value: "sum", label: "Sum" },
      { value: "mean", label: "Average" },
    ],
    onRun: (state) => toast({ message: `report: ${JSON.stringify(state.groupBy)}` }),
  });

  // settings-form (renders pref defs — pure config, no service)
  const sf = section("settings-form", "LEAF — renders registrations (the 'third framework').");
  const defs: PrefDef[] = [
    { key: "density", label: "Density", group: "Appearance", control: "select", options: [{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }], default: "comfortable" },
    { key: "autosave", label: "Autosave", group: "Editing", control: "toggle", default: true },
    { key: "alias", label: "Display alias", group: "Profile", control: "text", default: "" },
  ];
  const store = new Map<string, unknown>();
  mountSettingsForm(row(sf, "settings-form"), {
    defs,
    get: (k) => store.get(k) ?? defs.find((d) => d.key === k)?.default,
    set: (k, v) => store.set(k, v),
  });
}

/* ── composed / layout tier (W4) ─────────────────────────────────────────── */

function showcaseComposed(): void {
  // chart — real ECharts when window.echarts is present, else the empty placeholder.
  const chart = section("chart", "COMPOSED — ECharts tile via window.echarts (graceful no-op when absent).");
  const baked = synthesizeOption(
    SAMPLE_ROWS.map((r) => ({ name: r.name, value: r.cleanliness })),
    "bar",
  );
  const theme = THEMES["light"] ?? Object.values(THEMES)[0]!;
  const option = buildOption({ type: "bar", option: baked }, theme);
  mountChart(row(chart, "chart (live or empty)"), { title: "Cleanliness by file", option, id: "showcase-chart" });
  mountChart(row(chart, "chart (no option → empty)"), { title: "No data" });

  // filter-panel (+ filter-node algebra)
  const fp = section("filter-panel", "COMPOSED — builder for the pure FilterNode algebra.");
  const fph = row(fp, "filter-panel");
  fph.style.maxWidth = "20rem";
  mountFilterPanel(fph, {
    columns: [
      { key: "name", label: "Name" },
      { key: "rows", label: "Rows" },
    ],
    value: assembleFilter([], "and"),
    onApply: (node) => toast({ message: `filter: ${JSON.stringify(node.op)}` }),
  });

  // column-manager
  const cm = section("column-manager", "COMPOSED — column select + clean-op action sheets.");
  mountColumnManager(row(cm, "column-manager"), {
    columns: [
      { key: "name", label: "name" },
      { key: "rows", label: "rows" },
    ],
    ops: [
      { id: "trim", label: "Trim whitespace", icon: "bi-scissors", scope: "column" },
      { id: "dedup", label: "Dedup rows", icon: "bi-layers", scope: "global" },
    ],
    onApply: (op, cols) => toast({ message: `${op.label} on ${cols.join(",")}` }),
  });

  // joins-wizard (injected detect, in-memory)
  const jw = section("joins-wizard", "COMPOSED — join builder (injected detect/execute, in-memory).");
  mountJoinsWizard(row(jw, "joins-wizard"), {
    detect: () =>
      Promise.resolve({
        files: [
          { file_id: "FILE_1001", filename: "orders.csv", candidates: [{ this_col: "id", other_col: "order_id", matches: 980 }] },
        ],
      }),
    onExecute: () => Promise.resolve({}),
    onCancel: () => {},
  });

  // sql-editor
  const sql = section("sql-editor", "COMPOSED — SQL console (engine-agnostic; injected onRun).");
  mountSqlEditor(row(sql, "sql-editor"), {
    value: "select * from t limit 100",
    onRun: () => Promise.resolve({}),
    onMaterialize: () => Promise.resolve({}),
  });

  // steps-panel
  const steps = section("steps-panel", "COMPOSED — cleaning history + undo/redo.");
  mountStepsPanel(row(steps, "steps-panel"), {
    steps: [
      { kind: "trim", params: { column: "name" }, applied: true },
      { kind: "dedup", params: { mode: "rows" }, applied: true },
      { kind: "cast", params: { column: "rows" }, applied: false },
    ],
    canUndo: true,
    canRedo: true,
  });

  // workspace-panels
  const wsp = section("workspace-panels", "COMPOSED — responsive 3-region frame.");
  const wsph = row(wsp, "workspace-panels");
  wsph.style.minHeight = "16rem";
  const panels = mountWorkspacePanels(wsph);
  mountEmptyState(panels.left, { title: "Left", line: "rail / filters" });
  mountEmptyState(panels.center, { title: "Center", line: "the table" });
  mountEmptyState(panels.right, { title: "Right", line: "inspector" });

  // redtable
  const rt = section("redtable", "COMPOSED — THE data table (pager mode).");
  const rth = row(rt, "redtable");
  rth.style.minHeight = "18rem";
  mountRedTable(rth, {
    columns: [
      { key: "name", label: "Name" },
      { key: "rows", label: "Rows", dtype: "int" },
      { key: "cleanliness", label: "Score", dtype: "int" },
    ],
    rows: SAMPLE_ROWS,
    rowKey: (r) => String((r as { rid?: string }).rid ?? ""),
    mode: "pager",
    pageSize: 5,
    sortable: true,
  });

  // grid-view (toolbar + redtable composer)
  const gv = section("grid-view", "COMPOSED — thin composer: grid-toolbar + redtable.");
  const gvh = row(gv, "grid-view");
  gvh.style.minHeight = "18rem";
  mountGridView(gvh, {
    toolbar: {
      controls: [
        { kind: "search", id: "search", placeholder: "Search…" },
        { kind: "button", id: "refresh", icon: "bi-arrow-clockwise", title: "Refresh" },
      ],
    },
    table: {
      columns: [
        { key: "name", label: "Name" },
        { key: "rows", label: "Rows", dtype: "int" },
      ],
      rows: SAMPLE_ROWS,
      rowKey: (r) => String((r as { rid?: string }).rid ?? ""),
      mode: "pager",
      pageSize: 5,
    },
  });

  // topbar (decoupled — injected nav)
  const tb = section("topbar", "COMPOSED — chrome top bar (injected nav, no app-registry hardwire).");
  mountTopbar(row(tb, "topbar"), {
    nav: {
      items: [
        { id: "workspace", label: "Workspace", icon: "bi-table" },
        { id: "reports", label: "Reports", icon: "bi-bar-chart" },
      ],
      active: "workspace",
    },
    apps: { items: [{ id: "data", label: "Data" }, { id: "admin", label: "Admin" }], onSelect: (id) => toast({ message: `app: ${id}` }) },
  });

  // rail (UI-only, zero fetch)
  const rail = section("rail", "COMPOSED — navigation rail (UI only, zero fetch).");
  const railh = row(rail, "rail");
  railh.style.minHeight = "20rem";
  mountRail(railh, {
    search: { placeholder: "Filter…" },
    groups: [
      { id: "g1", name: "Sales", count: 3, tabs: [{ id: "t1", name: "orders.csv", icon: "bi-file-earmark", active: true }, { id: "t2", name: "returns.csv", icon: "bi-file-earmark" }] },
      { id: "g2", name: "Ops", count: 1, tabs: [{ id: "t3", name: "tickets.csv", icon: "bi-file-earmark" }] },
    ],
    footer: { create: { label: "New file" }, universals: { profileInitials: "EM", themeLabel: "Theme" } },
  });
}

/* ── data / RBAC-coupled tier (W5) — MOCK injected sources ───────────────── */

function showcaseData(): void {
  // perm-cell
  const perm = section("perm-cell", "DATA — pure RBAC matrix cell (config cycle order, onChange).");
  const ph = row(perm, "perm-cell (click to cycle)");
  mountPermCell(ph, { value: "r", onChange: (next) => toast({ message: `perm → ${next || "none"}` }) });
  mountPermCell(ph, { value: "rw" });
  mountPermCell(ph, { value: "" });

  // omni (injected source)
  const omni = section("omni", "DATA — omnisearch via an injected Source (MOCK, in-memory).");
  const oh = row(omni, "omni (type to search)");
  mountOmni(oh, {
    source: omniSource,
    kinds: { file: { label: "File", icon: "bi-file-earmark" } },
    placeholder: "Search files…",
    onSelect: (r) => toast({ message: `open ${r.label}` }),
  });

  // message-thread (injected poll source + send)
  const mt = section("message-thread", "DATA — feed + composer via injected source/send (MOCK).");
  const mth = row(mt, "message-thread");
  mth.style.minHeight = "20rem";
  mountMessageThread(mth, {
    source: threadSource,
    send: (text) => Promise.resolve({ id: `m${Date.now()}`, author: "USER_me", at: new Date().toISOString(), body: text }),
    pollMs: 60_000,
  });

  // chart-editor (injected columns/preview sources)
  const ce = section("chart-editor", "DATA — chart authoring + live preview via injected sources (MOCK).");
  const ceh = row(ce, "chart-editor");
  ceh.style.minHeight = "22rem";
  mountChartEditor(ceh, {
    files: [{ rid: "FILE_1001", filename: "orders.csv" }],
    columns: () => Promise.resolve(["region", "amount", "qty"]),
    preview: () =>
      Promise.resolve([
        ["North", 1200],
        ["South", 900],
        ["East", 1500],
        ["West", 700],
      ]),
  });

  // rail-data (controller: injected loader + callbacks)
  const rd = section("rail-data", "DATA — the rail controller: injected loader + callbacks (MOCK).");
  const rdh = row(rd, "rail-data");
  rdh.style.minHeight = "20rem";
  mountRailData(rdh, {
    load: () =>
      Promise.resolve({
        groups: [
          { id: "g1", name: "Sales", tabs: [{ id: "t1", name: "orders.csv", icon: "bi-file-earmark", renamable: true, hidable: true }] },
          { id: "g2", name: "Ops", tabs: [{ id: "t2", name: "tickets.csv", icon: "bi-file-earmark" }] },
        ],
      }),
    onNavigate: (tab) => toast({ message: `nav ${tab.id}` }),
    onTheme: () => setMode(getMode() === "dark" ? "light" : "dark"),
    profileInitials: "EM",
    themeLabel: "Theme",
  });

  // object-list (generic CRUD body: injected source + types over the seam)
  const ol = section("object-list", "DATA — generic object table: injected source + type catalogue (MOCK).");
  const olh = row(ol, "object-list");
  olh.style.minHeight = "22rem";
  mountObjectList(olh, {
    type: "file",
    types: typesSource,
    source: () => Promise.resolve({ items: SAMPLE_ROWS }),
    onAction: () => Promise.resolve({}),
    onOpen: (r) => toast({ message: `open ${(r as { name?: string }).name ?? ""}` }),
  });
}

/* ── engine — the graceful no-wasm path (AC-I3) ──────────────────────────── */

async function showcaseEngine(): Promise<void> {
  const eng = section("engine", "OPTIONAL — wasm-engine + window-source degrade cleanly with NO wasm path.");
  const slot = row(eng, "engine (no wasm configured)");

  // Configure with NO wasm path → getEngine() resolves null, no throw, no log.
  configureEngine({});
  const engine = await getEngine();

  // pickSource with no client/server config → a source whose ops yield EMPTY.
  const source = pickSource({});
  const page = await source.window(null, 0, 25);
  source.destroy();

  mountEmptyState(slot, {
    title: engine === null ? "No engine — graceful empty state" : "Engine present",
    line: `getEngine() → ${engine === null ? "null" : "loaded"}; window() → ${page.total} rows (clean degrade).`,
  });
}

/* ── registry round-trip (AC-K1 optional) ────────────────────────────────── */

function showcaseRegistry(): void {
  const sec = section("registry", "Every specimen is also register()ed; listComponents() enumerates them.");
  const names = listComponents().map((c) => c.name);
  const list = el("ul", { class: "amu-showcase-reglist" });
  for (const n of names) list.append(el("li", {}, n));
  row(sec, `${names.length} components registered (subset shown by gallery): ${registered.length} via toMount`).append(list);
}

/* ── boot ────────────────────────────────────────────────────────────────── */

mountHeader();
showcaseLeaf();
showcaseComposed();
showcaseData();
showcaseRegistry();
void showcaseEngine();
