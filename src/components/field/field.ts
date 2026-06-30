/* field — labeled form row wrapping any control node.
   mountField(host, {label, help?, control, inline?, bare?}). */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface FieldCfg {
  label: string;
  help?: string;
  control: Node;
  inline?: boolean;
  /** No outer margin — for hosts that own their own row rhythm. */
  bare?: boolean;
}

export interface FieldUpdate {
  error?: string | null;
}

export function mountField(host: Element, cfg: FieldCfg): MountHandle<FieldUpdate> {
  const cls = ["amu-field"];
  if (cfg.inline) cls.push("amu-field--inline");
  if (cfg.bare) cls.push("amu-field--bare");
  const row = el(
    "label",
    { class: cls.join(" ") },
    el("span", { class: "amu-field-label" }, cfg.label),
    cfg.control,
    cfg.help ? el("span", { class: "amu-field-help" }, cfg.help) : null,
  );
  const error = el("span", { class: "amu-field-error" });
  host.append(row);
  return {
    el: row,
    update: (p: FieldUpdate) => {
      if ("error" in p) {
        error.textContent = p.error ?? "";
        if (p.error && !error.isConnected) row.append(error);
        if (!p.error) error.remove();
      }
    },
    destroy: () => row.remove(),
  };
}
