/* steps-panel — a cleaning history + undo/redo. The canonical view is base +
   replay of applied steps; undo is a flag flip — this panel shows exactly that.
   mountStepsPanel(host, {steps: [{kind, params, applied}], canUndo, canRedo,
   onUndo, onRedo}). Composes atoms.button. Sole owner of .amu-steps*. */

import { el } from "../../kernel/dom.ts";
import { button } from "../atoms/atoms.ts";
import type { MountHandle } from "../../contract/index.ts";

/** One cleaning step. `params` is consumer DATA; describe() reads a few generic
    keys (column / cols / mode) for the detail line. */
export interface CleaningStep {
  kind: string;
  params?: { column?: unknown; cols?: unknown[]; mode?: unknown } & Record<string, unknown>;
  applied?: boolean;
}

export interface StepsPanelCfg {
  steps?: CleaningStep[];
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export type StepsPanelUpdate = Partial<StepsPanelCfg>;

function describe(step: CleaningStep): string {
  const p = step.params ?? {};
  if (p.column) return String(p.column);
  if (Array.isArray(p.cols)) return p.cols.join(", ");
  if (p.mode) return String(p.mode);
  return "";
}

export function mountStepsPanel(host: Element, cfg: StepsPanelCfg): MountHandle<StepsPanelUpdate> {
  let current: StepsPanelCfg = cfg;
  const root = el("div", { class: "amu-steps" });
  const list = el("ul", { class: "amu-steps-list" });
  const undoBtn = button({ label: "Undo", size: "sm", onClick: () => current.onUndo?.() });
  const redoBtn = button({ label: "Redo", size: "sm", onClick: () => current.onRedo?.() });
  root.append(
    el(
      "div",
      { class: "amu-steps-head" },
      el("h3", { class: "amu-steps-title" }, "Cleaning steps"),
      el("div", { class: "amu-steps-actions" }, undoBtn, redoBtn),
    ),
    list,
  );

  function render(c: StepsPanelCfg): void {
    undoBtn.disabled = !c.canUndo;
    redoBtn.disabled = !c.canRedo;
    const steps = c.steps ?? [];
    if (!steps.length) {
      list.replaceChildren(
        el("li", { class: "amu-steps-none" }, "No steps yet — the file is untouched."),
      );
      return;
    }
    list.replaceChildren(
      ...steps.map((s) =>
        el(
          "li",
          { class: `amu-steps-item${s.applied ? "" : " is-undone"}` },
          el("span", { class: "amu-steps-kind" }, s.kind),
          el("span", { class: "amu-steps-detail" }, describe(s)),
        ),
      ),
    );
  }

  render(current);
  host.append(root);
  return {
    el: root,
    update: (p: StepsPanelUpdate) => {
      current = { ...current, ...p };
      render(current);
    },
    destroy: () => root.remove(),
  };
}
