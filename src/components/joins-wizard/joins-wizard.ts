/* joins-wizard — the multi-file join flow. Renders INTO host (the orchestrator
   opens the modal; this never opens its own). It OWNS its markup; sole owner of
   .amu-jw*.

   mountJoinsWizard(host, {
     detect: () => Promise<DetectResult>,   // joinable files + candidate key pairs
     onExecute: (body) => Promise<unknown>, // { other_file, left_keys, right_keys,
                                            //   join_type, materialize_as? }
     onCancel: () => void,
   }) -> { el, update, destroy }

   On mount it calls detect() (spinner -> results). A list of candidate files;
   selecting one reveals its candidate key pairs as pickable rows (radio-like). A
   join_type <select> + a "Result name" input (-> materialize_as). Footer: Join
   (accent, disabled until a pair is chosen) + Cancel. Empty detect => empty-state.
   Composes atoms.button/input/chip/spinner + mountSelect + mountEmptyState. */

import { el } from "../../kernel/dom.ts";
import { button, input, chip, spinner } from "../atoms/atoms.ts";
import { mountSelect } from "../select/select.ts";
import { mountEmptyState } from "../empty-state/empty-state.ts";
import type { MountHandle } from "../../contract/index.ts";

/** One candidate key pair between the open file and another file. */
export interface JoinCandidate {
  this_col: string;
  other_col: string;
  matches?: number;
  this_uniques?: number;
  other_uniques?: number;
  samples?: unknown[];
}

/** A joinable file with its candidate key pairs. */
export interface JoinFile {
  file_id: string;
  filename?: string;
  candidates?: JoinCandidate[];
}

export interface DetectResult {
  files?: JoinFile[];
}

/** The execute body — keys are arrays so multi-key joins extend cleanly. */
export interface JoinExecuteBody {
  other_file: string;
  left_keys: string[];
  right_keys: string[];
  join_type: string;
  materialize_as?: string;
}

export interface JoinsWizardCfg {
  detect?: () => Promise<DetectResult>;
  onExecute?: (body: JoinExecuteBody) => Promise<unknown>;
  onCancel?: () => void;
}

const JOIN_TYPES = [
  { value: "inner", label: "Inner" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "outer", label: "Outer" },
  { value: "cross", label: "Cross" },
];

export function mountJoinsWizard(host: Element, cfg: JoinsWizardCfg): MountHandle {
  const root = el("div", { class: "amu-jw" });

  let files: JoinFile[] = [];
  let selectedFile: JoinFile | null = null;
  let selectedPair: JoinCandidate | null = null;
  let joinType = "inner";
  let resultName = "";

  // mutable region nodes
  const body = el("div", { class: "amu-jw-body" });
  const foot = el("div", { class: "amu-jw-foot" });
  const cancelBtn = button({ label: "Cancel", variant: "ghost", onClick: () => cfg.onCancel?.() });
  const joinBtn = button({ label: "Join", variant: "accent", onClick: execute });
  foot.append(cancelBtn, joinBtn);
  root.append(body, foot);

  function setJoinEnabled(): void {
    joinBtn.disabled = !selectedPair;
  }

  function showLoading(): void {
    body.replaceChildren(
      el("div", { class: "amu-jw-loading" }, spinner(), el("span", {}, "Finding joinable files…")),
    );
    foot.replaceChildren(cancelBtn, joinBtn); // footer persists; Join disabled
    setJoinEnabled();
  }

  function showError(message?: string): void {
    body.replaceChildren(
      el("div", { class: "amu-jw-error" }, message || "Could not detect joinable files."),
    );
    setJoinEnabled();
  }

  function showEmpty(): void {
    body.replaceChildren();
    mountEmptyState(body, {
      title: "No joinable files",
      line: "Upload another file to this project to join against it.",
    });
    foot.replaceChildren(cancelBtn); // nothing to join — only Cancel
  }

  function fileRow(file: JoinFile): HTMLElement {
    const active = !!selectedFile && selectedFile.file_id === file.file_id;
    const n = (file.candidates ?? []).length;
    return el(
      "button",
      {
        class: `amu-jw-file${active ? " is-active" : ""}`,
        type: "button",
        "aria-pressed": active ? "true" : "false",
        onclick: () => {
          selectedFile = file;
          selectedPair = null;
          render();
        },
      },
      el("span", { class: "amu-jw-file-name" }, file.filename ?? file.file_id),
      el("span", { class: "amu-jw-file-meta" }, `${n} key${n === 1 ? "" : "s"}`),
    );
  }

  function pairRow(cand: JoinCandidate): HTMLElement {
    const active =
      !!selectedPair &&
      selectedPair.this_col === cand.this_col &&
      selectedPair.other_col === cand.other_col;
    const head = el(
      "div",
      { class: "amu-jw-pair-head" },
      el(
        "span",
        { class: "amu-jw-pair-keys" },
        el("code", { class: "amu-jw-key" }, cand.this_col),
        el("span", { class: "amu-jw-arrow" }, "→"),
        el("code", { class: "amu-jw-key" }, cand.other_col),
      ),
      el("span", { class: "amu-jw-matches" }, `${cand.matches ?? 0} matches`),
    );
    const samples = el(
      "div",
      { class: "amu-jw-samples" },
      ...(cand.samples ?? []).slice(0, 6).map((s) => chip({ label: String(s) })),
    );
    return el(
      "button",
      {
        class: `amu-jw-pair${active ? " is-active" : ""}`,
        type: "button",
        "aria-pressed": active ? "true" : "false",
        onclick: () => {
          selectedPair = cand;
          render();
        },
      },
      head,
      (cand.samples ?? []).length ? samples : null,
    );
  }

  function renderResults(): void {
    body.replaceChildren();

    const fileList = el(
      "div",
      { class: "amu-jw-files" },
      el("h3", { class: "amu-jw-heading" }, "File to join"),
      ...files.map(fileRow),
    );
    body.append(fileList);

    if (selectedFile) {
      const cands = selectedFile.candidates ?? [];
      const pairs = el(
        "div",
        { class: "amu-jw-pairs" },
        el("h3", { class: "amu-jw-heading" }, "Key to join on"),
      );
      if (cands.length) {
        pairs.append(...cands.map(pairRow));
      } else {
        pairs.append(
          el("p", { class: "amu-jw-nokeys" }, "No matching key columns for this file."),
        );
      }
      body.append(pairs);

      // options row: join type + result name
      const opts = el("div", { class: "amu-jw-opts" });
      const typeHost = el("span", { class: "amu-jw-type" });
      mountSelect(typeHost, {
        options: JOIN_TYPES,
        value: joinType,
        onChange: (v) => (joinType = v),
      });
      const nameInput = input({
        placeholder: "Result name (optional)",
        value: resultName,
        onInput: (v) => (resultName = v),
      });
      nameInput.classList.add("amu-jw-name");
      opts.append(
        el(
          "label",
          { class: "amu-jw-opt" },
          el("span", { class: "amu-jw-opt-label" }, "Join type"),
          typeHost,
        ),
        el(
          "label",
          { class: "amu-jw-opt" },
          el("span", { class: "amu-jw-opt-label" }, "Result name"),
          nameInput,
        ),
      );
      body.append(opts);
    }

    foot.replaceChildren(cancelBtn, joinBtn);
    setJoinEnabled();
  }

  function render(): void {
    if (!files.length) {
      showEmpty();
      return;
    }
    renderResults();
  }

  async function execute(): Promise<void> {
    if (!selectedPair || !selectedFile) return;
    const payload: JoinExecuteBody = {
      other_file: selectedFile.file_id,
      left_keys: [selectedPair.this_col],
      right_keys: [selectedPair.other_col],
      join_type: joinType,
    };
    const name = resultName.trim();
    if (name) payload.materialize_as = name;
    joinBtn.disabled = true;
    try {
      await cfg.onExecute?.(payload);
    } catch (e) {
      // re-enable so the user can retry; surface nothing fancy (dev UX)
      setJoinEnabled();
      throw e;
    }
  }

  async function load(): Promise<void> {
    showLoading();
    try {
      const res = await cfg.detect?.();
      files = res?.files ?? [];
      render();
    } catch (e) {
      showError(e instanceof Error ? e.message : undefined);
    }
  }

  host.append(root);
  void load();

  return {
    el: root,
    update: () => render(),
    destroy: () => root.remove(),
  };
}
