/* column-manager — a per-column cleaning surface (DC3b). Sole owner of
   .amu-colmgr-*. A column multi-select + the clean-op palette (global +
   column-scoped), with an INLINE action-sheet (built from field.ts) for ops that
   take params. The ops are DATA (the consumer's clean-catalog) — this component
   reads only the generic id/label/icon/scope/min/max/fields and emits onApply; the
   consumer owns op.build, so the component never depends on a page module.
   Composes atoms.button/input + mountField + mountSelect. */

import { el } from "../../kernel/dom.ts";
import { button, input } from "../atoms/atoms.ts";
import { mountField } from "../field/field.ts";
import { mountSelect } from "../select/select.ts";
import type { MountHandle } from "../../contract/index.ts";

/** A field on a clean-op's action-sheet (consumer-supplied DATA). */
export interface CleanField {
  key: string;
  label: string;
  type?: "enum" | "bool" | "sentinels" | "number" | "text";
  default?: unknown;
  placeholder?: string;
  /** enum options as [value, label] tuples. */
  options?: [string, string][];
}

/** A clean-op spec (consumer DATA — the clean-catalog). */
export interface CleanOp {
  id?: string;
  label: string;
  icon?: string;
  scope?: "global" | "column" | string;
  min?: number;
  max?: number;
  fields?: CleanField[];
}

export interface ColumnManagerColumn {
  key: string;
  label?: string;
}

/** The values collected from an op's action-sheet, keyed by field key. */
export type CleanValues = Record<string, unknown>;

export interface ColumnManagerCfg {
  columns?: ColumnManagerColumn[];
  ops?: CleanOp[];
  onApply?: (op: CleanOp, cols: string[], values: CleanValues) => void;
}

export interface ColumnManagerUpdate {
  columns?: ColumnManagerColumn[];
}

/** Is `op` runnable for `n` selected columns? scope/min/max are plain data on each
    op. Global ops are always runnable. */
function enabled(op: CleanOp, n: number): boolean {
  if (op.scope === "global") return true;
  const min = op.min ?? 1;
  const max = op.max ?? Infinity;
  return n >= min && n <= max;
}

/** A human reason an op is currently disabled (for the button title). */
function disabledReason(op: CleanOp, n: number): string {
  const min = op.min ?? 1;
  const max = op.max ?? Infinity;
  if (min === max) return `Select exactly ${min} column${min > 1 ? "s" : ""}`;
  if (n < min) return `Select at least ${min} column${min > 1 ? "s" : ""}`;
  return `Select at most ${max} columns`;
}

const splitList = (v: unknown): string[] =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");

export function mountColumnManager(
  host: Element,
  cfg: ColumnManagerCfg,
): MountHandle<ColumnManagerUpdate> {
  let columns = cfg.columns ?? [];
  const ops = cfg.ops ?? [];
  const selected = new Set<string>();
  let activeOp: CleanOp | null = null; // the op whose action-sheet is open
  let values: CleanValues = {}; // field values for the active op

  const root = el("div", { class: "amu-colmgr" });
  const head = el("div", { class: "amu-colmgr-head" });
  const colsEl = el("div", { class: "amu-colmgr-cols" });
  const opsEl = el("div", { class: "amu-colmgr-ops" });
  const sheetEl = el("div", { class: "amu-colmgr-sheet" });
  root.append(head, colsEl, opsEl, sheetEl);

  function defaults(op: CleanOp): CleanValues {
    const v: CleanValues = {};
    for (const f of op.fields ?? []) {
      v[f.key] = f.default ?? (f.type === "bool" ? false : f.type === "sentinels" ? [] : "");
    }
    return v;
  }

  /* the control node for one field, wired to write back into `values`. */
  function controlFor(f: CleanField): Node {
    if (f.type === "enum") {
      const hostEl = el("span", { class: "amu-colmgr-control" });
      mountSelect(hostEl, {
        options: (f.options ?? []).map(([value, label]) => ({ value, label })),
        value: typeof values[f.key] === "string" ? (values[f.key] as string) : undefined,
        onChange: (v) => (values[f.key] = v),
      });
      return hostEl;
    }
    if (f.type === "bool") {
      const box = el("input", { type: "checkbox" });
      box.checked = !!values[f.key];
      box.addEventListener("change", () => (values[f.key] = box.checked));
      return box;
    }
    if (f.type === "sentinels") {
      return input({
        placeholder: f.placeholder ?? "N/A, -, ???",
        value: (Array.isArray(values[f.key]) ? (values[f.key] as string[]) : []).join(", "),
        onInput: (v) => (values[f.key] = splitList(v)),
      });
    }
    return input({
      type: f.type === "number" ? "number" : "text",
      placeholder: f.placeholder,
      value: typeof values[f.key] === "string" ? (values[f.key] as string) : "",
      onInput: (v) => (values[f.key] = v),
    });
  }

  function openOp(op: CleanOp): void {
    if (!enabled(op, selected.size)) return;
    if (!(op.fields && op.fields.length)) {
      cfg.onApply?.(op, [...selected], {});
      return;
    }
    activeOp = op;
    values = defaults(op);
    render();
  }

  function opButton(op: CleanOp): HTMLButtonElement {
    const on = enabled(op, selected.size);
    const b = button({
      label: op.label,
      icon: op.icon,
      variant: activeOp === op ? "accent" : "ghost",
      disabled: !on,
      title: on ? undefined : disabledReason(op, selected.size),
      onClick: () => openOp(op),
    });
    b.classList.add("amu-colmgr-op");
    return b;
  }

  function renderHead(): void {
    head.replaceChildren(el("span", { class: "amu-colmgr-title" }, "Columns"));
    if (selected.size) {
      head.append(
        el("span", { class: "amu-colmgr-count" }, `${selected.size} selected`),
        button({
          label: "Clear",
          variant: "ghost",
          size: "sm",
          onClick: () => {
            selected.clear();
            render();
          },
        }),
      );
    }
  }

  function renderCols(): void {
    colsEl.replaceChildren(
      ...columns.map((c) => {
        const box = el("input", { type: "checkbox" });
        box.checked = selected.has(c.key);
        box.addEventListener("change", () => {
          if (box.checked) selected.add(c.key);
          else selected.delete(c.key);
          render();
        });
        return el(
          "label",
          { class: "amu-colmgr-col" },
          box,
          el("span", { class: "amu-colmgr-col-name" }, c.label ?? c.key),
        );
      }),
    );
    if (!columns.length) {
      colsEl.append(el("p", { class: "amu-colmgr-empty" }, "No columns."));
    }
  }

  function renderOps(): void {
    const global = ops.filter((o) => o.scope === "global");
    const column = ops.filter((o) => o.scope !== "global");
    opsEl.replaceChildren(
      el("div", { class: "amu-colmgr-group-label" }, "Whole file"),
      el("div", { class: "amu-colmgr-op-row" }, ...global.map(opButton)),
      el("div", { class: "amu-colmgr-group-label" }, "Selected columns"),
      selected.size
        ? el("div", { class: "amu-colmgr-op-row" }, ...column.map(opButton))
        : el("p", { class: "amu-colmgr-empty" }, "Select one or more columns to clean them."),
    );
  }

  function renderSheet(): void {
    sheetEl.replaceChildren();
    if (!activeOp) return;
    const op = activeOp;
    sheetEl.append(el("div", { class: "amu-colmgr-sheet-title" }, op.label));
    for (const f of op.fields ?? []) {
      mountField(sheetEl, { label: f.label, control: controlFor(f) });
    }
    sheetEl.append(
      el(
        "div",
        { class: "amu-colmgr-sheet-foot" },
        button({
          label: "Cancel",
          variant: "ghost",
          onClick: () => {
            activeOp = null;
            render();
          },
        }),
        button({
          label: "Apply",
          variant: "accent",
          onClick: () => {
            cfg.onApply?.(op, [...selected], values);
            activeOp = null;
            render();
          },
        }),
      ),
    );
  }

  function render(): void {
    // a selection change can invalidate an open sheet (e.g. dropped below min).
    if (activeOp && !enabled(activeOp, selected.size)) activeOp = null;
    renderHead();
    renderCols();
    renderOps();
    renderSheet();
  }

  render();
  host.append(root);

  return {
    el: root,
    update: (p: ColumnManagerUpdate = {}) => {
      if (p.columns) {
        columns = p.columns;
        const keys = new Set(columns.map((c) => c.key));
        for (const k of [...selected]) if (!keys.has(k)) selected.delete(k);
      }
      render();
    },
    destroy: () => root.remove(),
  };
}
