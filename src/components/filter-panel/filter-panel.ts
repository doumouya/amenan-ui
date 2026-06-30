/* filter-panel — the builder for the shared FilterNode tree. Lives in a ~280px
   side panel (Linear density). It OWNS its markup; all FilterNode <-> row logic is
   the pure filter-node.ts (so it is unit-testable without a DOM). Composes
   atoms.button/input + mountSelect — never re-implements them.

   mountFilterPanel(host, {
     columns: [{ key, label }],        // the column <select> options
     value?:  FilterNode,              // seed rows by decomposing a top Group
     onApply(node: FilterNode),        // assembled Group{op, children:[Pred|Group…]}
     onClear(),                        // rows emptied to one blank row
   }) -> { el, update({columns, value}), destroy }

   Sole owner of every .amu-fp* class (ui-fork-audit R4). */

import { el } from "../../kernel/dom.ts";
import { button, input } from "../atoms/atoms.ts";
import { mountSelect } from "../select/select.ts";
import type { MountHandle } from "../../contract/index.ts";
import {
  PRED_OPS,
  VALUELESS_OPS,
  RANGE_OPS,
  LIST_OPS,
  blankRow,
  blankGroup,
  assembleFilter,
  decomposeFilter,
} from "./filter-node.ts";
import type { Combinator, FilterNode, RowModel, PredRow, GroupRowModel } from "./filter-node.ts";

/** How deep "Add group" will nest (root rows = depth 0; a group at this depth no
    longer offers nesting). Keeps a hand-built tree legible in a 280px panel. */
const MAX_GROUP_DEPTH = 2;

export interface FilterColumn {
  key: string;
  label?: string;
}

export interface FilterPanelCfg {
  columns?: FilterColumn[];
  value?: FilterNode | null;
  onApply?: (node: FilterNode) => void;
  onClear?: () => void;
}

export interface FilterPanelUpdate {
  columns?: FilterColumn[];
  value?: FilterNode | null;
}

function isGroupRow(row: RowModel): row is GroupRowModel {
  return (row as GroupRowModel).group === true;
}

export function mountFilterPanel(
  host: Element,
  cfg: FilterPanelCfg,
): MountHandle<FilterPanelUpdate> {
  let columns = cfg.columns ?? [];
  const rows: RowModel[] = []; // identity STABLE — seed/clear mutate in place so
  let combinator: Combinator = "and"; // the add bar (closes over `rows`) stays live.

  const root = el("div", { class: "amu-fp" });
  const combo = el("div", { class: "amu-fp-combo" });
  const list = el("div", { class: "amu-fp-rows" });
  const topAdd = addBar(rows, 0);
  const foot = el(
    "div",
    { class: "amu-fp-foot" },
    button({ label: "Clear", variant: "ghost", onClick: clearAll }),
    button({ label: "Apply", variant: "accent", onClick: apply }),
  );
  root.append(combo, list, topAdd, foot);

  /* Replace the row set IN PLACE (rows identity must stay stable). */
  function setRows(next: RowModel[]): void {
    rows.length = 0;
    rows.push(...next);
  }

  function seed(value: FilterNode | null | undefined): void {
    const d = decomposeFilter(value);
    setRows(d.rows);
    combinator = d.combinator;
  }

  function columnOptions(): { value: string; label: string }[] {
    return columns.map((c) => ({ value: c.key, label: c.label ?? c.key }));
  }

  /* the value cell adapts to the op — returns the node to slot into the row. */
  function valueCell(row: PredRow): HTMLElement {
    const cell = el("span", { class: "amu-fp-value" });
    const op = row.op ?? "";
    if (VALUELESS_OPS.has(op)) {
      return cell; // empty placeholder keeps the grid aligned
    }
    if (RANGE_OPS.has(op)) {
      const lo = input({
        type: "number",
        placeholder: "min",
        value: row.from,
        onInput: (v) => (row.from = v),
      });
      const hi = input({
        type: "number",
        placeholder: "max",
        value: row.to,
        onInput: (v) => (row.to = v),
      });
      lo.classList.add("amu-fp-num");
      hi.classList.add("amu-fp-num");
      cell.append(lo, el("span", { class: "amu-fp-and" }, "and"), hi);
      return cell;
    }
    const placeholder = LIST_OPS.has(op) ? "a, b, c" : "value";
    const txt = input({ placeholder, value: row.value, onInput: (v) => (row.value = v) });
    txt.classList.add("amu-fp-text");
    cell.append(txt);
    return cell;
  }

  /* An All / Any segmented toggle bound to `activeOp`/`onChange`. Shared by the
     top combinator and each nested group's own operator. */
  function comboSeg(activeOp: Combinator, onChange: (op: Combinator) => void): HTMLElement {
    const seg = el("div", { class: "amu-fp-seg", role: "group", "aria-label": "Match" });
    for (const opt of [
      { v: "and" as const, l: "All" },
      { v: "or" as const, l: "Any" },
    ]) {
      seg.append(
        el(
          "button",
          {
            class: `amu-fp-seg-btn${activeOp === opt.v ? " is-active" : ""}`,
            type: "button",
            "aria-pressed": activeOp === opt.v ? "true" : "false",
            onclick: () => onChange(opt.v),
          },
          opt.l,
        ),
      );
    }
    return seg;
  }

  /* A predicate row. `arr` is the array that holds it (top rows or a group's
     children) so remove splices the right list. */
  function predRow(row: PredRow, arr: RowModel[], i: number): HTMLElement {
    const colHost = el("span", { class: "amu-fp-col" });
    mountSelect(colHost, {
      options: [{ value: "", label: "Column…" }, ...columnOptions()],
      value: row.col,
      onChange: (v) => (row.col = v),
    });
    const opHost = el("span", { class: "amu-fp-op" });
    mountSelect(opHost, {
      options: PRED_OPS,
      value: row.op,
      onChange: (v) => {
        row.op = v;
        render(); // op change reshapes the value cell
      },
    });
    const remove = button({
      label: "✕",
      variant: "ghost",
      size: "sm",
      onClick: () => removeAt(arr, i),
    });
    remove.classList.add("amu-fp-remove");
    remove.setAttribute("aria-label", "Remove condition");
    return el("div", { class: "amu-fp-row" }, colHost, opHost, valueCell(row), remove);
  }

  /* A nested AND/OR group row: its own All/Any toggle + a remove, then its child
     rows, then its own add bar. Renders recursively (depth feeds the nest cap). */
  function groupRow(row: GroupRowModel, arr: RowModel[], i: number, depth: number): HTMLElement {
    const remove = button({
      label: "✕",
      variant: "ghost",
      size: "sm",
      onClick: () => removeAt(arr, i),
    });
    remove.classList.add("amu-fp-remove");
    remove.setAttribute("aria-label", "Remove group");
    const head = el(
      "div",
      { class: "amu-fp-group-head" },
      comboSeg(row.op, (v) => {
        row.op = v;
        render();
      }),
      remove,
    );
    const childList = el("div", { class: "amu-fp-rows" });
    renderInto(childList, row.children, depth + 1);
    return el("div", { class: "amu-fp-group" }, head, childList, addBar(row.children, depth + 1));
  }

  function buildRow(row: RowModel, arr: RowModel[], i: number, depth: number): HTMLElement {
    return isGroupRow(row) ? groupRow(row, arr, i, depth) : predRow(row, arr, i);
  }

  function renderInto(container: HTMLElement, arr: RowModel[], depth: number): void {
    container.replaceChildren(...arr.map((r, i) => buildRow(r, arr, i, depth)));
  }

  /* "+ Add condition" (+ "+ Add group" until the nest cap) for a given list. */
  function addBar(arr: RowModel[], depth: number): HTMLElement {
    const bar = el("div", { class: "amu-fp-add" });
    bar.append(
      button({
        label: "+ Add condition",
        variant: "ghost",
        size: "sm",
        onClick: () => {
          arr.push(blankRow());
          render();
        },
      }),
    );
    if (depth < MAX_GROUP_DEPTH) {
      bar.append(
        button({
          label: "+ Add group",
          variant: "ghost",
          size: "sm",
          onClick: () => {
            arr.push(blankGroup());
            render();
          },
        }),
      );
    }
    return bar;
  }

  /* Remove from a list; the TOP list never goes empty (reseed one blank row) so
     the panel always shows something. A nested group may empty — assembleFilter
     drops a childless group, and the user can still remove the group itself. */
  function removeAt(arr: RowModel[], i: number): void {
    arr.splice(i, 1);
    if (arr === rows && rows.length === 0) rows.push(blankRow());
    render();
  }

  function renderCombo(): void {
    combo.replaceChildren();
    if (rows.length <= 1) return;
    combo.append(
      el("span", { class: "amu-fp-combo-label" }, "Match"),
      comboSeg(combinator, (v) => {
        combinator = v;
        renderCombo();
      }),
    );
  }

  function render(): void {
    renderInto(list, rows, 0);
    renderCombo();
  }

  function clearAll(): void {
    setRows([blankRow()]);
    combinator = "and";
    render();
    cfg.onClear?.();
  }

  function apply(): void {
    cfg.onApply?.(assembleFilter(rows, combinator));
  }

  seed(cfg.value);
  render();
  host.append(root);

  return {
    el: root,
    update: (p: FilterPanelUpdate = {}) => {
      if (p.columns) columns = p.columns;
      if ("value" in p) seed(p.value);
      render();
    },
    destroy: () => root.remove(),
  };
}
