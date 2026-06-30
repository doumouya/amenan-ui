/* grid-view — a thin COMPOSER: stacks [toolbar?] [sheet?] [redtable] in a flex
   column. It owns no behavior — it wires a grid-toolbar (optional) above a
   redtable, with an optional arbitrary "sheet" node slotted between them (a score
   badge, a banner, a steps strip). Omit `toolbar` and it is just the redtable.
   The redtable's flex-fill makes it take the remaining height of this column.

   mountGridView(host, {
     toolbar?: GridToolbarCfg,   // → mountGridToolbar
     table:   RedTableCfg,       // REQUIRED → mountRedTable
     sheet?:  Node | null,        // slotted between the two
   }) → { el, table, toolbar, setSheet(node|null),
          update({rows, columns, state}), destroy }

   `table` / `toolbar` are the child handles (so a consumer drives the redtable
   interaction + the toolbar state directly). update fans out: rows/columns →
   table.update, state → toolbar.update. Sole owner of .amu-gridview
   (ui-fork-audit R4). */

import { el } from "../../kernel/dom.ts";
import { mountRedTable } from "../redtable/redtable.ts";
import type { RedTableCfg, RedTableHandle, RedTableRow, RedTableColumn } from "../redtable/redtable.ts";
import { mountGridToolbar } from "../grid-toolbar/grid-toolbar.ts";
import type { GridToolbarCfg, GridToolbarHandle, ToolbarState } from "../grid-toolbar/grid-toolbar.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface GridViewCfg<S = ToolbarState> {
  toolbar?: GridToolbarCfg<S>;
  table?: RedTableCfg;
  sheet?: Node | null;
}

export interface GridViewUpdate<S = ToolbarState> {
  rows?: RedTableRow[];
  columns?: RedTableColumn[];
  state?: S;
}

export interface GridViewHandle<S = ToolbarState> extends MountHandle<GridViewUpdate<S>> {
  table: RedTableHandle;
  toolbar: GridToolbarHandle<S> | null;
  setSheet: (node: Node | null) => void;
}

export function mountGridView<S = ToolbarState>(
  host: Element,
  cfg: GridViewCfg<S>,
): GridViewHandle<S> {
  const root = el("div", { class: "amu-gridview" });

  // toolbar (optional) — sits at the top, fixed height.
  let toolbar: GridToolbarHandle<S> | null = null;
  if (cfg.toolbar) {
    const tbHost = el("div", { class: "amu-gridview-toolbar" });
    root.append(tbHost);
    toolbar = mountGridToolbar<S>(tbHost, cfg.toolbar);
  }

  // sheet slot — an arbitrary node between toolbar and table (or empty).
  const sheetHost = el("div", { class: "amu-gridview-sheet" });
  root.append(sheetHost);
  function setSheet(node: Node | null): void {
    if (node) sheetHost.replaceChildren(node);
    else sheetHost.replaceChildren();
    sheetHost.classList.toggle("is-empty", !node);
  }
  setSheet(cfg.sheet ?? null);

  // table — REQUIRED. Lives in a flex-fill slot so the redtable's fill kicks in.
  const tableHost = el("div", { class: "amu-gridview-table" });
  root.append(tableHost);
  const table = mountRedTable(
    tableHost,
    cfg.table ?? { columns: [], rows: [], rowKey: (r) => String(r) },
  );

  host.append(root);
  return {
    el: root,
    table,
    toolbar,
    setSheet,
    update: (p: GridViewUpdate<S> = {}) => {
      const t: { rows?: RedTableRow[]; columns?: RedTableColumn[] } = {};
      if ("rows" in p) t.rows = p.rows;
      if ("columns" in p) t.columns = p.columns;
      if (Object.keys(t).length) table.update?.(t);
      if ("state" in p) toolbar?.update?.({ state: p.state });
    },
    destroy: () => {
      toolbar?.destroy?.();
      table.destroy?.();
      root.remove();
    },
  };
}
