/* editor-registry — the DEFAULT cell-editor index for redtable edit mode.
   Editors are data (an open registry keyed by dtype), exactly like components and
   types — so a new column type plugs an editor in without touching the table.
   registerEditor(dtype, factory) + defaultEditorFor(col) resolve a factory by the
   column's dtype, falling back to the text editor.

   DECOUPLING (AC-H2): redtable takes `editorFor(column)` as CONFIG — a callback —
   never a hardwired import of this module. This file provides the DEFAULTS; the
   consumer either passes its own `editorFor` to mountRedTable, or lets the table
   fall back to `defaultEditorFor` here. The two stay independent.

   A factory(td, { value, onCommit(value) }) takes over the <td>: it swaps the
   cell content for an input, commits on blur/Enter (calling onCommit with the
   parsed value), reverts on Escape, and restores the cell either way. It runs
   inside the table's edit interaction (redtable.ts) — the table owns where the
   commit goes (onCellCommit); the editor only shapes the value.

   Composes the atoms.input STYLE via the shared .amu-input class (atoms.css owns
   it; this seam declares no classes of its own — no CSS sheet, ui-fork-audit R4
   has nothing to own here). */

import { el } from "../../kernel/dom.ts";

/** The arguments a column-editor factory receives when it takes over a cell. */
export interface EditorArgs {
  value: unknown;
  onCommit?: (value: unknown) => void;
}

/** A live editor: the table calls commit()/cancel() when it needs to settle the
    cell programmatically (e.g. switching cells, leaving edit mode). */
export interface EditorHandle {
  commit: () => void;
  cancel: () => void;
  el: HTMLElement;
}

/** A cell-editor factory: takes over `td` and returns a live handle (or null to
    decline, leaving the cell untouched). */
export type EditorFactory = (td: HTMLElement, args: EditorArgs) => EditorHandle | null;

/** A column shape the resolver reads — the table's column, narrowed to the
    fields editor resolution needs. */
export interface EditorColumn {
  /** An explicit editor override (a dtype key into the registry). */
  editor?: string;
  /** The column's data type (the default resolution key). */
  dtype?: string;
}

const editors = new Map<string, EditorFactory>(); // dtype → factory

/** registerEditor(dtype, factory) — last writer wins by design (an app may
    override the default numeric editor with a richer one without forking the
    table). */
export function registerEditor(dtype: string, factory: EditorFactory): void {
  editors.set(dtype, factory);
}

/** defaultEditorFor(col) → factory. Resolves by col.editor (explicit override)
    then col.dtype, falling back to the text editor — every column is editable.
    This is the DEFAULT redtable uses when the consumer passes no `editorFor`. */
export function defaultEditorFor(col?: EditorColumn): EditorFactory {
  return (
    (col?.editor != null ? editors.get(col.editor) : undefined) ??
    (col?.dtype != null ? editors.get(col.dtype) : undefined) ??
    editors.get("text") ??
    makeEditor()
  );
}

/* ── the built-in editors ──────────────────────────────────────────────── */

interface MakeEditorOpts {
  type?: string;
  /** Shapes the committed string; returning undefined cancels the commit. */
  parse?: (s: string) => unknown;
}

/** Shared swap-commit-revert harness. `parse` shapes the committed string;
    returning undefined cancels the commit (kept the old value). */
function makeEditor({ type = "text", parse = (s: string): unknown => s }: MakeEditorOpts = {}): EditorFactory {
  return (td: HTMLElement, { value, onCommit }: EditorArgs): EditorHandle => {
    const prev = [...td.childNodes]; // restore exactly what was there
    const field = el("input", { class: "amu-input amu-redtable-editor", type });
    field.value = value == null ? "" : String(value);
    td.replaceChildren(field);
    field.focus();
    field.select();

    let done = false;
    const restore = (): void => td.replaceChildren(...prev);
    const commit = (): void => {
      if (done) return;
      done = true;
      const next = parse(field.value);
      restore();
      if (next !== undefined) onCommit?.(next);
    };
    const cancel = (): void => {
      if (done) return;
      done = true;
      restore();
    };
    field.addEventListener("blur", commit);
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        field.blur();
      }
    });
    return { commit, cancel, el: field };
  };
}

// number parser: blank → "" (a cleared cell), non-numeric → undefined (cancel).
function parseNumber(s: string): unknown {
  const t = s.trim();
  if (t === "") return "";
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

registerEditor("text", makeEditor());
registerEditor("int", makeEditor({ type: "number", parse: parseNumber }));
registerEditor("float", makeEditor({ type: "number", parse: parseNumber }));
