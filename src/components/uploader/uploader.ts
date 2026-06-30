/* uploader — drop zone + picker. mountUploader(host, {label?, hint?, accept?,
   multiple?, onFile(file), onFiles(files)}) — single by default (onFile); pass
   `multiple:true` + `onFiles` to accept several at once. handle.busy(on, msg?)
   toggles the in-flight state (msg shows progress). Composes atoms.spinner.
   Sole owner of .amu-uploader*. */

import { el } from "../../kernel/dom.ts";
import { spinner } from "../atoms/atoms.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface UploaderCfg {
  label?: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
}

export interface UploaderHandle extends MountHandle {
  /** Toggle the in-flight state; `msg` shows progress beside the spinner. */
  busy: (on: boolean, msg?: string) => void;
}

export function mountUploader(host: Element, cfg: UploaderCfg): UploaderHandle {
  const defaultLabel =
    cfg.label ??
    (cfg.multiple ? "Drop CSVs here, or click to choose" : "Drop a CSV here, or click to choose");
  const fileInput = el("input", { type: "file", accept: cfg.accept ?? ".csv,.tsv,.txt" });
  if (cfg.multiple) fileInput.multiple = true;
  const label = el("div", {}, defaultLabel);
  const zone = el(
    "div",
    { class: "amu-uploader", role: "button", tabindex: "0" },
    label,
    cfg.hint ? el("div", { class: "amu-uploader-hint" }, cfg.hint) : null,
    fileInput,
  );

  // Hand off the picked files: the multi-aware callback when present, else the
  // single-file callback with the first file (back-compat).
  function pick(fileList: FileList | null | undefined): void {
    const files = [...(fileList ?? [])].filter(Boolean);
    // Clear the input so re-picking the SAME file still fires `change` (a retry
    // after a failed upload) — `change` only fires when the value differs.
    fileInput.value = "";
    if (!files.length) return;
    if (cfg.onFiles) cfg.onFiles(files);
    else if (files[0]) cfg.onFile?.(files[0]);
  }
  zone.addEventListener("click", () => fileInput.click());
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });
  fileInput.addEventListener("change", () => pick(fileInput.files));
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("is-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("is-over");
    pick(e.dataTransfer?.files);
  });

  host.append(zone);
  return {
    el: zone,
    busy(on: boolean, msg?: string) {
      zone.classList.toggle("is-busy", on);
      // Disable the input while in flight — blocks the picker via click AND the
      // keyboard path (Enter/Space), which pointer-events:none alone does not.
      fileInput.disabled = on;
      label.replaceChildren(on ? spinner() : document.createTextNode(defaultLabel));
      if (on && msg) label.append(document.createTextNode(" " + msg));
    },
    update() {},
    destroy: () => zone.remove(),
  };
}
