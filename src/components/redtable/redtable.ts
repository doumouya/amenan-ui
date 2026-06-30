/* redtable — THE data table. ONE implementation; virtual and pager modes are
   config on the same component (the predecessor's fork-A/B duality is banned).
   Data col-keys ONLY (no display-index sentinels); rowKey REQUIRED (selection
   lives in closure state keyed by rowKey, never on recycled DOM). Sortable
   headers (config) emit onSort(col); the CONSUMER cycles the direction and
   re-fetches a server-sorted page — the chevron only ever reflects a real order.

   TWO independent axes, composed on the one component:
     mode        — LAYOUT: auto | virtual | pager (how many rows render).
     interaction — BEHAVIOR: browse | select | edit | delete (what a click does).

   DECOUPLING (AC-H2): the cell editors are NOT a hardwired registry import.
   `editorFor(column)` is passed in as CONFIG (a callback); editor-registry.ts
   provides `defaultEditorFor` as the fallback when no callback is given, so the
   consumer can fully override editing without forking the table.

   Composes mountPager (W3) + mountEmptyState (W3) + createVirtualRows. Sole owner
   of .amu-redtable* (ui-fork-audit R4). */

import { el, esc } from "../../kernel/dom.ts";
import { mountEmptyState } from "../empty-state/empty-state.ts";
import type { EmptyStateCfg } from "../empty-state/empty-state.ts";
import { mountPager } from "../pager/pager.ts";
import { createVirtualRows } from "./virtual-rows.ts";
import type { VirtualRowsHandle } from "./virtual-rows.ts";
import { defaultEditorFor } from "./editor-registry.ts";
import type { EditorFactory, EditorHandle } from "./editor-registry.ts";
import type { MountHandle } from "../../contract/index.ts";

const AUTO_VIRTUAL_AT = 200;

/** A row is an open object keyed by column key. */
export type RedTableRow = Record<string, unknown>;

export interface RedTableColumn {
  key: string;
  label?: string;
  /** "int"/"float" right-align + tabular figures; also the default editor key. */
  dtype?: string;
  /** An explicit editor override (a key into the consumer's editor resolution). */
  editor?: string;
}

export type RedTableMode = "auto" | "virtual" | "pager";
export type RedTableInteraction = "browse" | "select" | "edit" | "delete";

export interface RedTableSort {
  col: string;
  descending?: boolean;
}

export interface RedTableCfg {
  columns: RedTableColumn[];
  rows?: RedTableRow[];
  /** REQUIRED — the stable identity of a row (selection keys off this). */
  rowKey: (row: RedTableRow) => string;
  mode?: RedTableMode;
  pageSize?: number;
  interaction?: RedTableInteraction;
  onRowClick?: (row: RedTableRow | undefined, key: string) => void;
  onSelectChange?: (keys: string[]) => void;
  onRowDelete?: (key: string) => void;
  onCellCommit?: (rowKey: string, colKey: string, value: unknown) => void;
  /** Legacy alias for interaction:"select". */
  selectable?: boolean;
  /** Clickable headers → onSort(col). */
  sortable?: boolean;
  /** The active sort (drives the chevron). */
  sort?: RedTableSort | null;
  onSort?: (col: string) => void;
  /** A leading #-column (1-based view position). */
  rowNumbers?: boolean;
  /** Empty-state config when there are no rows. */
  empty?: EmptyStateCfg;
  /** INJECTED editor resolver (AC-H2). Given a column, returns the factory that
      takes over a cell in edit mode. Defaults to editor-registry's resolver. */
  editorFor?: (col: RedTableColumn) => EditorFactory;
}

export interface RedTableUpdate {
  rows?: RedTableRow[];
  columns?: RedTableColumn[];
  sort?: RedTableSort | null;
  rowNumbers?: boolean;
}

export interface RedTableHandle extends MountHandle<RedTableUpdate> {
  selection: () => string[];
  clearSelection: () => void;
  setInteraction: (m: RedTableInteraction) => void;
}

function cellHTML(row: RedTableRow, col: RedTableColumn): string {
  const v = row[col.key];
  if (v == null || v === "") return `<span class="amu-redtable-null">—</span>`;
  return esc(v);
}

export function mountRedTable(host: Element, cfg: RedTableCfg): RedTableHandle {
  if (typeof cfg.rowKey !== "function") {
    throw new Error("redtable: rowKey(row) is required");
  }
  let rows = cfg.rows ?? [];
  // legacy selectable: bool → the select interaction (one behavior, two names).
  let interaction: RedTableInteraction = cfg.interaction ?? (cfg.selectable ? "select" : "browse");
  const selected = new Set<string>(); // rowKey strings — never DOM state
  let activeEditor: EditorHandle | null = null; // while a cell is being edited
  // the injected resolver (AC-H2) — fall back to editor-registry's defaults.
  const resolveEditor = cfg.editorFor ?? defaultEditorFor;

  const root = el("div", { class: "amu-redtable" });
  const scroll = el("div", { class: "amu-redtable-scroll" });
  const table = el("table");
  const thead = el("thead");
  const tbody = el("tbody");
  table.append(thead, tbody);
  scroll.append(table);
  root.append(scroll);
  const foot = el("div", { class: "amu-redtable-foot" });
  let footMounted = false;

  let virt: VirtualRowsHandle | null = null;
  let page = 1;
  const pageSize = cfg.pageSize ?? 50;
  let emptyHandle: MountHandle | null = null;

  // ── interaction state class on the root (CSS keys the checkbox col, the
  //    editing-cell inset and the delete-mode hover off these). ────────────
  function applyInteractionClass(): void {
    root.classList.toggle("is-select", interaction === "select");
    root.classList.toggle("is-edit", interaction === "edit");
    root.classList.toggle("is-delete", interaction === "delete");
  }

  function mode(): "virtual" | "pager" {
    if (cfg.mode && cfg.mode !== "auto") return cfg.mode;
    return rows.length > AUTO_VIRTUAL_AT ? "virtual" : "pager";
  }

  // span across the FULL row incl. the select checkbox column when present.
  function colCount(): number {
    return cfg.columns.length + (interaction === "select" ? 1 : 0) + (cfg.rowNumbers ? 1 : 0);
  }

  function renderHead(): void {
    const ths = cfg.columns.map((c) => {
      if (!cfg.sortable) return el("th", { scope: "col" }, c.label ?? c.key);
      // sortable: clickable header + a chevron showing this column's sort state
      // (expand = unsorted, up = ascending, down = descending).
      const sorted = cfg.sort != null && cfg.sort.col === c.key;
      const chev = !sorted
        ? "bi-chevron-expand"
        : cfg.sort?.descending
          ? "bi-chevron-down"
          : "bi-chevron-up";
      return el(
        "th",
        {
          scope: "col",
          class: `amu-redtable-th-sort${sorted ? " is-sorted" : ""}`,
          "data-col": c.key,
        },
        c.label ?? c.key,
        el("i", { class: `amu-redtable-sort bi ${chev}`, "aria-hidden": "true" }),
      );
    });
    const lead: HTMLElement[] = [];
    if (cfg.rowNumbers) lead.push(el("th", { class: "amu-redtable-rownum", scope: "col" }, "#"));
    if (interaction === "select") {
      // a select-all checkbox heads the leading column.
      lead.push(
        el(
          "th",
          { class: "amu-redtable-check-cell", scope: "col" },
          el("input", {
            type: "checkbox",
            class: "amu-redtable-check amu-redtable-check-all",
            "aria-label": "Select all",
          }),
        ),
      );
    }
    thead.replaceChildren(el("tr", {}, ...lead, ...ths));
    syncSelectAll();
  }

  function rowEl(row: RedTableRow, absIndex = 0): HTMLTableRowElement {
    const key = cfg.rowKey(row);
    const tr = el("tr", { "data-key": key });
    if (selected.has(key)) tr.classList.add("is-selected");
    const cells = cfg.columns
      .map(
        (c) =>
          `<td data-col="${esc(c.key)}"${
            c.dtype === "int" || c.dtype === "float" ? ' class="amu-redtable-num"' : ""
          }>${cellHTML(row, c)}</td>`,
      )
      .join("");
    // a leading row-number and/or select-checkbox cell forces the node path
    // (tr.innerHTML would wipe them); a plain row keeps the fast innerHTML path.
    const hasLead = cfg.rowNumbers || interaction === "select";
    if (!hasLead) {
      tr.innerHTML = cells;
      return tr;
    }
    if (cfg.rowNumbers) {
      tr.append(el("td", { class: "amu-redtable-rownum" }, String(absIndex + 1)));
    }
    if (interaction === "select") {
      const box = el("input", {
        type: "checkbox",
        class: "amu-redtable-check",
        "aria-label": "Select row",
      });
      box.checked = selected.has(key);
      tr.append(el("td", { class: "amu-redtable-check-cell" }, box));
    }
    const holder = el("template");
    holder.innerHTML = cells;
    tr.append(holder.content);
    return tr;
  }

  function paint(): void {
    virt?.destroy();
    virt = null;
    emptyHandle?.destroy?.();
    emptyHandle = null;

    if (!rows.length) {
      tbody.replaceChildren();
      foot.replaceChildren();
      if (cfg.empty) {
        const holder = el("td", { colspan: String(colCount()) });
        emptyHandle = mountEmptyState(holder, cfg.empty);
        tbody.append(el("tr", {}, holder));
      }
      return;
    }

    if (mode() === "virtual") {
      foot.replaceChildren(); // virtual mode scrolls; no pager
      const rowHeight = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.25;
      virt = createVirtualRows({
        scrollHost: scroll,
        tbody,
        rowCount: rows.length,
        rowHeight,
        renderRow: (i) => {
          const r = rows[i];
          return r ? rowEl(r, i) : document.createElement("tr");
        },
      });
    } else {
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      page = Math.min(page, pages);
      const slice = rows.slice((page - 1) * pageSize, page * pageSize);
      tbody.replaceChildren(...slice.map((r, j) => rowEl(r, (page - 1) * pageSize + j)));
      foot.replaceChildren();
      mountPager(foot, {
        page,
        pages,
        total: rows.length,
        onPage: (p) => {
          page = p;
          paint();
        },
      });
      if (!footMounted) {
        root.append(foot);
        footMounted = true;
      }
    }
    syncSelectAll();
  }

  // ── select-all tri-state: checked when every row is selected, indeterminate
  //    when some are. Keyed by the full row set (selection is a closure Set). ──
  function syncSelectAll(): void {
    const box = thead.querySelector<HTMLInputElement>(".amu-redtable-check-all");
    if (!box) return;
    const total = rows.length;
    const n = selected.size;
    box.checked = total > 0 && n === total;
    box.indeterminate = n > 0 && n < total;
  }

  function emitSelection(): void {
    cfg.onSelectChange?.([...selected]);
  }

  // ── ONE delegated listener on tbody (survives repaint + virtual recycling),
  //    routed by the current interaction. ───────────────────────────────────
  tbody.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const tr = target?.closest<HTMLTableRowElement>("tr[data-key]");
    if (!tr) return;
    const key = tr.dataset.key ?? "";
    const row = rows.find((r) => cfg.rowKey(r) === key);

    if (interaction === "edit") {
      const td = target?.closest<HTMLTableCellElement>("td[data-col]");
      if (td && row) beginEdit(td, row);
      cfg.onRowClick?.(row, key);
      return;
    }
    if (interaction === "delete") {
      cfg.onRowDelete?.(key);
      cfg.onRowClick?.(row, key);
      return;
    }
    if (interaction === "select") {
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      tr.classList.toggle("is-selected", selected.has(key));
      const box = tr.querySelector<HTMLInputElement>(".amu-redtable-check");
      if (box) box.checked = selected.has(key);
      syncSelectAll();
      emitSelection();
    }
    cfg.onRowClick?.(row, key);
  });

  // ── select-all head checkbox + sortable header — one listener on thead. ─────
  thead.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const box = target?.closest<HTMLInputElement>(".amu-redtable-check-all");
    if (box) {
      if (box.checked) for (const r of rows) selected.add(cfg.rowKey(r));
      else selected.clear();
      // reflect onto the rendered rows without a full repaint.
      for (const tr of tbody.querySelectorAll<HTMLTableRowElement>("tr[data-key]")) {
        const on = selected.has(tr.dataset.key ?? "");
        tr.classList.toggle("is-selected", on);
        const c = tr.querySelector<HTMLInputElement>(".amu-redtable-check");
        if (c) c.checked = on;
      }
      syncSelectAll();
      emitSelection();
      return;
    }
    // sortable header click → report the column; the consumer owns the cycle
    // (asc → desc → off) + the re-fetch, then reflects it via update({sort}).
    if (cfg.sortable) {
      const th = target?.closest<HTMLTableCellElement>("th[data-col]");
      if (th?.dataset.col != null) cfg.onSort?.(th.dataset.col);
    }
  });

  // ── edit mode: swap the clicked cell for its registered editor; the editor
  //    commits via onCellCommit(rowKey, colKey, value). Only ONE cell edits at
  //    a time (committing the previous first). ──────────────────────────────
  function beginEdit(td: HTMLTableCellElement, row: RedTableRow): void {
    if (activeEditor) {
      activeEditor.commit();
      activeEditor = null;
    }
    const colKey = td.dataset.col ?? "";
    const col = cfg.columns.find((c) => c.key === colKey);
    if (!col) return;
    const key = cfg.rowKey(row);
    const factory = resolveEditor(col);
    activeEditor =
      factory(td, {
        value: row[colKey],
        onCommit: (value) => {
          activeEditor = null;
          cfg.onCellCommit?.(key, colKey, value);
        },
      }) ?? null;
  }

  applyInteractionClass();
  renderHead();
  paint();
  host.append(root);

  return {
    el: root,
    update: (p: RedTableUpdate = {}) => {
      if (p.rows) {
        rows = p.rows;
        page = 1;
        // a row set change can orphan selected keys — keep only the ones that
        // still exist (selection is keyed by rowKey, the source of truth).
        if (selected.size) {
          const live = new Set(rows.map((r) => cfg.rowKey(r)));
          for (const k of [...selected]) if (!live.has(k)) selected.delete(k);
        }
      }
      if ("sort" in p) cfg.sort = p.sort;
      if ("rowNumbers" in p && p.rowNumbers !== undefined) cfg.rowNumbers = p.rowNumbers;
      if (p.columns) cfg.columns = p.columns;
      if (p.columns || "sort" in p || "rowNumbers" in p) renderHead();
      paint();
    },
    selection: () => [...selected],
    clearSelection: () => {
      selected.clear();
      for (const tr of tbody.querySelectorAll<HTMLTableRowElement>("tr.is-selected")) {
        tr.classList.remove("is-selected");
        const c = tr.querySelector<HTMLInputElement>(".amu-redtable-check");
        if (c) c.checked = false;
      }
      syncSelectAll();
      emitSelection();
    },
    /** Flip the interaction axis live (browse↔select↔edit↔delete). Re-renders
        head + body so the checkbox column appears/disappears in one pass. */
    setInteraction: (m: RedTableInteraction) => {
      if (m === interaction) return;
      if (activeEditor) {
        activeEditor.cancel();
        activeEditor = null;
      }
      interaction = m;
      applyInteractionClass();
      renderHead();
      paint();
    },
    destroy: () => {
      virt?.destroy();
      root.remove();
    },
  };
}
