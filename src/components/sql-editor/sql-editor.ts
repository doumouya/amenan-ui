/* sql-editor — a SQL console surface. Sole owner of .amu-sqleditor-*.
   knob: --sqleditor-input-min-h

   mountSqlEditor(host, {
     value?: string,                         // seed query (the last one run)
     suggestName?: () => string,             // default name for "Save as file"
     onRun(query) -> Promise<unknown>,       // run; resolve = caller showed the result
     onMaterialize(query, name) -> Promise,  // write the result as a new file
   }) -> { el, query(), destroy }

   A SQL textarea over the open file (exposed as table `t`), Run + "Save as file"
   (materialize), and an inline status line. Engine-agnostic: the consumer wires
   onRun/onMaterialize to its data seam. On a successful Run the consumer swaps the
   grid + closes this panel, so success shows nothing here; an ERROR keeps the panel
   open with the message. Composes atoms.input. */

import { el } from "../../kernel/dom.ts";
import { button, input } from "../atoms/atoms.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface SqlEditorCfg {
  value?: string;
  suggestName?: () => string;
  onRun?: (query: string) => Promise<unknown>;
  onMaterialize?: (query: string, name: string) => Promise<unknown>;
}

export interface SqlEditorHandle extends MountHandle {
  query(): string;
}

type StatusTone = "muted" | "ok" | "danger" | "";

export function mountSqlEditor(host: Element, cfg: SqlEditorCfg): SqlEditorHandle {
  const root = el("div", { class: "amu-sqleditor" });

  const area = el("textarea", {
    class: "amu-sqleditor-input",
    placeholder: "SELECT * FROM t LIMIT 100",
    spellcheck: "false",
    rows: "6",
  });
  area.value = cfg.value ?? "";

  const status = el("div", { class: "amu-sqleditor-status" });
  const setStatus = (msg?: string, tone?: StatusTone): void => {
    status.textContent = msg ?? "";
    status.dataset.tone = tone ?? "";
  };

  const name = input({ placeholder: "result name", value: cfg.suggestName?.() ?? "" });
  name.classList.add("amu-sqleditor-name");

  const run = button({ label: "Run", variant: "accent", onClick: doRun });
  const save = button({ label: "Save as file", variant: "ghost", onClick: doSave });

  root.append(
    el(
      "div",
      { class: "amu-sqleditor-hint" },
      "Query the open file as table ",
      el("code", { class: "amu-sqleditor-t" }, "t"),
      " — read-only.",
    ),
    area,
    el(
      "div",
      { class: "amu-sqleditor-foot" },
      status,
      el("div", { class: "amu-sqleditor-actions" }, name, save, run),
    ),
  );

  async function doRun(): Promise<void> {
    const q = area.value.trim();
    if (!q) return;
    setStatus("Running…", "muted");
    run.disabled = true;
    try {
      await cfg.onRun?.(q); // success: the consumer swapped the grid + closed this panel
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Query failed", "danger");
    } finally {
      run.disabled = false;
    }
  }

  async function doSave(): Promise<void> {
    const q = area.value.trim();
    if (!q) return;
    setStatus("Saving…", "muted");
    save.disabled = true;
    try {
      await cfg.onMaterialize?.(q, name.value.trim() || "query_result");
      setStatus("Saved as a new file.", "ok");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed", "danger");
    } finally {
      save.disabled = false;
    }
  }

  host.append(root);
  return { el: root, query: () => area.value, destroy: () => root.remove() };
}
