/* select — single-choice control over the native <select> (keyboard, a11y, and
   mobile come free; a custom listbox is complexity the UI doesn't need).
   mountSelect(host, {options: [{value,label}], value, onChange}). */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectCfg {
  options?: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
}

export interface SelectUpdate {
  options?: SelectOption[];
  value?: string;
}

export function mountSelect(host: Element, cfg: SelectCfg): MountHandle<SelectUpdate> {
  const sel = el("select", { class: "amu-select" });
  function render(options: SelectOption[], value?: string): void {
    sel.replaceChildren(
      ...options.map((o) => {
        const opt = el("option", { value: o.value }, o.label);
        if (o.value === value) opt.selected = true;
        return opt;
      }),
    );
  }
  render(cfg.options ?? [], cfg.value);
  sel.addEventListener("change", () => cfg.onChange?.(sel.value));
  host.append(sel);
  return {
    el: sel,
    update: (p: SelectUpdate) => render(p.options ?? cfg.options ?? [], p.value ?? sel.value),
    destroy: () => sel.remove(),
  };
}
