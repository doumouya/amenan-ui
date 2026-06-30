/* object-list — THE generic object-table page body. Given an object type, it
   renders that type's list with zero per-type code: columns DERIVE from the type
   registry (over the Service seam), rows from the injected source, CRUD through
   the injected `onAction` callbacks. `update({ type })` switches the type.

   Composes the redtable FAMILY (mountGridView) — the same data-table toolbar the
   Workspace carries: search · FILTER (the only summonable PANEL) · edit/select/
   delete modes · refresh · row-numbers · rows-per-page · show/hide columns ·
   download. Items load fully, so filter + search run CLIENT-side over the rows.

   DECOUPLING (AC-H3): every coupling becomes an INJECTED seam:
     · the server objects fetch → `config.source(type)` (the row loader).
     · the type catalogue → `config.types` (a Service or a Source<TypeDef[]>),
       passed to the type-registry's `getTypes` — no global fetch wrapper import.
     · the create/patch/delete writes → `config.onAction`
       (`{ kind: "create"|"edit"|"delete", type, rid?, data? }`) → Promise.
     · READ_ONLY + REQUIRED-fields are CONFIG (per-type maps), not the hardcoded
       `file`/`project` + `{user,company,team}` of the source framework.
   There is no server-path literal, no fetch, no global transport import anywhere.

   mountObjectList(host, config) → { el, update({ type, filter? }), current(),
     destroy } */

import { el } from "../../kernel/dom.ts";
import { mountGridView } from "../grid-view/grid-view.ts";
import type { ControlSpec } from "../grid-toolbar/grid-toolbar.ts";
import { mountFilterPanel } from "../filter-panel/filter-panel.ts";
import { evalFilter, isEmptyFilter } from "../filter-panel/filter-node.ts";
import type { FilterNode } from "../filter-panel/filter-node.ts";
import { mountEmptyState } from "../empty-state/empty-state.ts";
import { mountField } from "../field/field.ts";
import { openModal, confirmModal } from "../modal/modal.ts";
import type { ModalHandle } from "../modal/modal.ts";
import { input } from "../atoms/atoms.ts";
import { toast } from "../toast/toast.ts";
import { getTypes } from "../../registry/type-registry.ts";
import type { TypeDef } from "../../registry/type-registry.ts";
import type { Service, Source } from "../../contract/index.ts";

type ObjRow = Record<string, unknown> & { rid?: string };

/** A mutation dispatched to the consumer. `kind` says what; the consumer writes. */
export interface ObjectAction {
  kind: "create" | "edit" | "delete";
  type: string;
  /** The row identity (edit/delete). */
  rid?: string;
  /** The changed/new field values (create/edit). */
  data?: Record<string, unknown>;
}

/** The opaque per-control toolbar state (the predicates read it). */
interface ListState {
  typeLabel: string;
  typeLabelPlural: string;
  creatable: boolean;
  createTitle: string | null;
  columns: { key: string; label: string; hidden: boolean }[];
  query: string;
  hasFilter: boolean;
  selectionCount: number;
  mode: Mode;
  rowNumbers: boolean;
  pageRows: number;
  editable: boolean;
}

type Mode = "browse" | "edit" | "select" | "delete";

export interface ObjectListConfig {
  /** The active object type id (the rail chooses it). */
  type?: string;
  /** The type catalogue source (Service or Source<TypeDef[]>) — passed to
      the type-registry. Required to derive columns from the type def. */
  types?: Service | Source<TypeDef[]>;
  /** The row loader — `source(type)` → the rows for a type. Replaces
      `api.get("/objects/<type>")`. */
  source?: (type: string) => Promise<{ items?: ObjRow[] } | ObjRow[]>;
  /** Column override (else derived from the type def). */
  columns?: { key: string; label?: string }[];
  /** Browse-mode row click → onOpen(row) (e.g. open a file). */
  onOpen?: (row: ObjRow) => void;
  /** The create/edit/delete write callback (replaces api.post/patch/del). */
  onAction?: (action: ObjectAction) => Promise<unknown>;
  /** An injected create flow override — lights up the toolbar "+" on a browse-
      only / sourced list with a custom create. */
  create?: { label?: string; onCreate?: () => void };
  /** CONFIG read-only type ids: browse · filter · delete only, no create/edit.
      Was the hardcoded `new Set(["file","project"])`. */
  readOnly?: string[];
  /** CONFIG required-field keys per type id. Was the hardcoded
      `{user,company,team}` map. */
  required?: Record<string, string[]>;
  /** A type's plural display name, per type id (else `<display_name>s`). */
  pluralOf?: Record<string, string>;
}

const PAGE_SIZES = [25, 50, 100, 500];

/* The toolbar as DATA — the only summonable PANEL is filter. */
function listToolbar(s: ListState): ControlSpec<ListState>[] {
  const c: ControlSpec<ListState>[] = [];
  if (s.creatable) {
    c.push({
      kind: "button",
      id: "new",
      icon: "bi-plus-lg",
      title: s.createTitle ?? `New ${s.typeLabel}`,
    });
  }
  c.push(
    { kind: "toggle", id: "filter", icon: "bi-funnel", title: "Filter", active: (st) => st.hasFilter },
    { kind: "sep" },
    { kind: "search", id: "search", placeholder: `Search ${s.typeLabelPlural.toLowerCase()}…`, value: s.query },
    { kind: "sep" },
    { kind: "toggle", id: "edit", icon: "bi-pencil", title: "Edit cells", group: "mode", active: (st) => st.mode === "edit" },
    { kind: "toggle", id: "select", icon: "bi-check2-square", title: "Select rows", group: "mode", active: (st) => st.mode === "select" },
    { kind: "toggle", id: "delete", icon: "bi-trash3", title: "Delete rows", group: "mode", active: (st) => st.mode === "delete" },
    { kind: "button", id: "delsel", icon: "bi-trash", title: "Delete selected", when: (st) => st.selectionCount > 0 },
    { kind: "chip", id: "clearsel", visible: (st) => st.selectionCount > 0, label: (st) => `${st.selectionCount} selected` },
    { kind: "sep" },
    { kind: "button", id: "refresh", icon: "bi-arrow-clockwise", title: "Refresh" },
    { kind: "toggle", id: "rownum", icon: "bi-hash", title: "Row numbers", active: (st) => st.rowNumbers },
    { kind: "sep" },
    {
      kind: "menu",
      id: "rows",
      icon: "bi-list-ol",
      title: "Rows per page",
      items: PAGE_SIZES.map((n) => ({ id: String(n), label: `${n} rows`, icon: n === s.pageRows ? "bi-check2" : "" })),
    },
    {
      kind: "menu",
      id: "cols",
      icon: "bi-layout-three-columns",
      title: "Show / hide columns",
      items: s.columns.map((col) => ({ id: col.key, label: col.label, icon: col.hidden ? "" : "bi-check2" })),
    },
    { kind: "menu", id: "export", icon: "bi-download", title: "Download / export", items: [{ id: "csv", label: "CSV" }] },
  );
  return c;
}

function itemsOf(out: { items?: ObjRow[] } | ObjRow[]): ObjRow[] {
  if (Array.isArray(out)) return out;
  return out.items ?? [];
}

export function mountObjectList(host: Element, cfg: ObjectListConfig) {
  const root = el("div", { class: "amu-objlist" });
  host.append(root);

  const readOnly = new Set(cfg.readOnly ?? []);
  const required = cfg.required ?? {};

  let current: TypeDef | null = null; // the type def
  let gridView: ReturnType<typeof mountGridView<ListState>> | null = null;
  let items: ObjRow[] = []; // all loaded rows (client-side; not server-paged)
  let query = "";
  let filterNode: FilterNode | null = null;
  const hiddenCols = new Set<string>();
  let selection: string[] = [];
  let mode: Mode = "browse";
  let rowNumbers = false;
  let pageRows = 50;
  let seq = 0; // guards rapid type switches racing their loads

  const labelOf = (t: TypeDef, key: string): string =>
    t.fields.find((f) => f.key === key)?.label ?? key;
  const pluralOf = (t: TypeDef): string => cfg.pluralOf?.[t.type_id] ?? `${t.display_name}s`;
  const isReadOnly = (id: string): boolean => readOnly.has(id);

  // Presence on the wire MEANS readable: drop a builtin column every row lacks.
  // A caller override (cfg.columns) wins; custom types are sparse, so keep all.
  function fields(): { key: string; label?: string }[] {
    if (cfg.columns) return cfg.columns;
    const def = current;
    if (!def) return [];
    return def.is_builtin && items.length
      ? def.fields.filter((f) => items.some((r) => f.key in r))
      : def.fields;
  }
  const visibleColumns = () =>
    fields()
      .map((f) => ({ key: f.key, label: f.label ?? f.key }))
      .filter((c) => !hiddenCols.has(c.key));
  function visibleRows(): ObjRow[] {
    const q = query.trim().toLowerCase();
    const cols = visibleColumns();
    return items.filter((r) => {
      if (filterNode && !evalFilter(filterNode, r)) return false;
      if (q && !cols.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function toolbarState(): ListState {
    const editable = !!current && !cfg.source && !isReadOnly(current.type_id);
    return {
      typeLabel: current?.display_name ?? "object",
      typeLabelPlural: current ? pluralOf(current) : "objects",
      creatable: !!cfg.create || editable,
      createTitle: cfg.create?.label ?? null,
      columns: fields().map((f) => ({ key: f.key, label: f.label ?? f.key, hidden: hiddenCols.has(f.key) })),
      query,
      hasFilter: !!filterNode,
      selectionCount: selection.length,
      mode,
      rowNumbers,
      pageRows,
      editable,
    };
  }
  function paint(): void {
    gridView?.update?.({ columns: visibleColumns(), rows: visibleRows(), state: toolbarState() });
  }
  function refreshToolbar(): void {
    const s = toolbarState();
    gridView?.toolbar?.update?.({ state: s, controls: listToolbar(s) });
  }

  // build (or rebuild — e.g. on a rows-per-page change) the gridView from state.
  function mountTable(): void {
    gridView?.destroy?.();
    const s = toolbarState();
    gridView = mountGridView<ListState>(root, {
      toolbar: { controls: listToolbar(s), onAction, state: s },
      table: {
        columns: visibleColumns(),
        rows: visibleRows(),
        rowKey: (r) => String((r as ObjRow).rid ?? ""),
        mode: "pager",
        pageSize: pageRows,
        interaction: mode,
        rowNumbers,
        onSelectChange: (keys) => {
          selection = keys;
          refreshToolbar();
        },
        onCellCommit: commitEdit,
        onRowDelete: commitDelete,
        onRowClick: (row) => {
          if (mode === "browse" && row) cfg.onOpen?.(row as ObjRow);
        },
        empty: {
          title: current ? `No ${pluralOf(current).toLowerCase()} yet` : "Nothing here",
          line:
            current && !isReadOnly(current.type_id) && !cfg.source
              ? `Create the first one with “New ${current.display_name.toLowerCase()}”.`
              : "Nothing to show here.",
        },
      },
    });
  }

  async function defOf(typeId: string): Promise<TypeDef | null> {
    if (!cfg.types) return null;
    const all = await getTypes(cfg.types);
    return all.find((t) => t.type_id === typeId) ?? null;
  }

  async function loadRows(typeId: string): Promise<ObjRow[]> {
    if (!cfg.source) return [];
    return itemsOf(await cfg.source(typeId));
  }

  async function show(typeId: string): Promise<void> {
    const my = ++seq;
    let def: TypeDef | null;
    try {
      def = await defOf(typeId);
    } catch {
      def = null;
    }
    if (my !== seq) return;
    current = def;
    filterNode = null;
    query = "";
    hiddenCols.clear();
    selection = [];
    mode = "browse";
    items = [];
    gridView?.destroy?.();
    gridView = null;
    root.replaceChildren();

    if (!def) {
      mountEmptyState(root, {
        title: "Type unavailable",
        line: "The object catalog did not answer for this type.",
      });
      return;
    }
    try {
      items = await loadRows(typeId);
    } catch (e) {
      if (my !== seq) return;
      const msg = e instanceof Error ? e.message : "";
      mountEmptyState(root, {
        title: `${pluralOf(def)} unavailable`,
        line: msg ? `The server said: ${msg}` : "Could not reach the server.",
      });
      return;
    }
    if (my !== seq) return;
    mountTable();
  }

  // re-load + repaint after a mutation, preserving the filter/search view + mode.
  async function reload(): Promise<void> {
    if (!current) return;
    try {
      items = await loadRows(current.type_id);
    } catch {
      /* keep prior */
    }
    selection = [];
    gridView?.table?.clearSelection?.();
    paint();
    refreshToolbar();
  }

  function setMode(next: Mode): void {
    mode = mode === next ? "browse" : next;
    gridView?.table?.setInteraction(mode);
    if (mode !== "select") {
      gridView?.table?.clearSelection?.();
      selection = [];
    }
    refreshToolbar();
  }

  function onAction(id: string, ctx: { value?: string; menu?: string }): unknown {
    if (id === "search") {
      query = ctx.value ?? "";
      paint();
      return;
    }
    if (id === "filter") {
      openFilter();
      return;
    }
    if (ctx.menu === "cols") {
      if (hiddenCols.has(id)) hiddenCols.delete(id);
      else hiddenCols.add(id);
      paint();
      refreshToolbar();
      return;
    }
    if (ctx.menu === "rows") {
      pageRows = Number(id);
      mountTable();
      return;
    }
    if (ctx.menu === "export") {
      exportCsv();
      return;
    }
    switch (id) {
      case "new":
        (cfg.create?.onCreate ?? openCreate)();
        return;
      case "edit":
      case "select":
      case "delete":
        setMode(id);
        return;
      case "delsel":
        void deleteSelected();
        return;
      case "clearsel":
        gridView?.table?.clearSelection?.();
        selection = [];
        refreshToolbar();
        return;
      case "refresh":
        return reload();
      case "rownum":
        rowNumbers = !rowNumbers;
        gridView?.table?.update?.({ rowNumbers });
        refreshToolbar();
        return;
    }
  }

  function openFilter(): void {
    const fhost = el("div");
    const modal = openModal({ title: "Filter", body: fhost, actions: [] });
    mountFilterPanel(fhost, {
      columns: fields().map((f) => ({ key: f.key, label: f.label ?? f.key })),
      value: filterNode,
      onApply: (node) => {
        filterNode = isEmptyFilter(node) ? null : node;
        paint();
        refreshToolbar();
        modal.close();
      },
      onClear: () => {
        filterNode = null;
        paint();
        refreshToolbar();
        modal.close();
      },
    });
  }

  // edit-mode: a committed cell edit → the onAction edit callback.
  async function commitEdit(rowKey: string, colKey: string, value: unknown): Promise<void> {
    const type = current?.type_id;
    if (!type || cfg.source || isReadOnly(type) || !cfg.onAction) return;
    try {
      await cfg.onAction({ kind: "edit", type, rid: rowKey, data: { [colKey]: value } });
    } catch (e) {
      toast({ message: (e instanceof Error && e.message) || "Edit failed", tone: "danger" });
      await reload();
    }
  }

  // delete-mode: a clicked row → confirm → delete (single).
  async function commitDelete(rowKey: string): Promise<void> {
    const t = current;
    if (!t || !cfg.onAction) return;
    const ok = await confirmModal({
      title: `Delete this ${t.display_name.toLowerCase()}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await cfg.onAction({ kind: "delete", type: t.type_id, rid: rowKey });
      toast({ message: `${t.display_name} deleted` });
    } catch (e) {
      toast({ message: (e instanceof Error && e.message) || "Delete failed", tone: "danger" });
    }
    await reload();
  }

  // select-mode: bulk-delete the current selection (one confirm).
  async function deleteSelected(): Promise<void> {
    const selected = gridView?.table?.selection() ?? [];
    const t = current;
    if (!selected.length || !t || !cfg.onAction) return;
    const what =
      selected.length === 1
        ? `this ${t.display_name.toLowerCase()}`
        : `${selected.length} ${pluralOf(t).toLowerCase()}`;
    const ok = await confirmModal({
      title: `Delete ${what}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      for (const rid of selected) await cfg.onAction({ kind: "delete", type: t.type_id, rid });
      toast({ message: selected.length === 1 ? `${t.display_name} deleted` : `${selected.length} deleted` });
    } catch (e) {
      toast({ message: (e instanceof Error && e.message) || "Delete failed", tone: "danger" });
    }
    await reload();
  }

  function openCreate(): void {
    const t = current;
    if (!t || cfg.source || isReadOnly(t.type_id) || !cfg.onAction) return;
    const req = required[t.type_id] ?? [];
    const keys = required[t.type_id] ?? t.fields.map((f) => f.key);
    const values: Record<string, string> = Object.fromEntries(keys.map((k) => [k, ""]));
    let modal: ModalHandle | null = null;
    async function submit(): Promise<void> {
      const missing = req.find((k) => !(values[k] ?? "").trim());
      if (missing) {
        toast({ message: `${labelOf(t!, missing)} is required`, tone: "danger" });
        return;
      }
      try {
        const data = Object.fromEntries(
          keys.filter((k) => (values[k] ?? "").trim()).map((k) => [k, (values[k] ?? "").trim()]),
        );
        await cfg.onAction!({ kind: "create", type: t!.type_id, data });
        modal?.close();
        toast({ message: `${t!.display_name} created` });
        await reload();
      } catch (e) {
        toast({ message: (e instanceof Error && e.message) || "Create failed", tone: "danger" });
      }
    }
    const body = el("div", { class: "amu-objlist-form" });
    for (const k of keys) {
      mountField(body, {
        label: labelOf(t, k),
        control: input({
          onInput: (v) => {
            values[k] = v;
          },
          onEnter: () => void submit(),
        }),
      });
    }
    modal = openModal({
      title: `New ${t.display_name.toLowerCase()}`,
      body,
      actions: [
        { label: "Cancel", variant: "ghost", onClick: ({ close }) => close() },
        { label: "Create", variant: "accent", onClick: () => void submit() },
      ],
    });
  }

  // download the CURRENT (filtered) view as CSV, client-side — no server endpoint.
  function exportCsv(): void {
    const cols = visibleColumns();
    const rows = visibleRows();
    const cell = (v: unknown): string => {
      const sv = String(v ?? "");
      return /[",\n]/.test(sv) ? `"${sv.replace(/"/g, '""')}"` : sv;
    };
    const csv = [
      cols.map((c) => cell(c.label)).join(","),
      ...rows.map((r) => cols.map((c) => cell(r[c.key])).join(",")),
    ].join("\n");
    const name = current ? `${pluralOf(current)}.csv` : "objects.csv";
    const a = el("a", {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: name,
    });
    a.click();
    URL.revokeObjectURL((a as HTMLAnchorElement).href);
  }

  if (cfg.type) void show(cfg.type);

  return {
    el: root,
    /** Type switch re-shows; an external FilterNode (e.g. a rail status tab)
        scopes the loaded rows client-side. `filter:null` clears. */
    update: (p: { type?: string; filter?: FilterNode | null } = {}) => {
      if (p.type) {
        void show(p.type);
        return;
      }
      if ("filter" in p) {
        filterNode = p.filter ?? null;
        paint();
        refreshToolbar();
      }
    },
    current: () => current?.type_id ?? null,
    destroy: () => {
      gridView?.destroy?.();
      root.remove();
    },
  };
}
