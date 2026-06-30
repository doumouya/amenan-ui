/* chip-row — single-select tabs over atoms.chip.
   mountChipRow(host, {items: [{value,label}], value, onChange}). */

import { el } from "../../kernel/dom.ts";
import { chip } from "../atoms/atoms.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface ChipRowItem {
  value: string;
  label: string;
}

export interface ChipRowCfg {
  items?: ChipRowItem[];
  value?: string;
  onChange?: (value: string) => void;
}

export interface ChipRowUpdate {
  items?: ChipRowItem[];
  value?: string;
}

export function mountChipRow(host: Element, cfg: ChipRowCfg): MountHandle<ChipRowUpdate> {
  const row = el("div", { class: "amu-chip-row", role: "tablist" });
  let items = cfg.items ?? [];
  let value = cfg.value;
  function render(): void {
    row.replaceChildren(
      ...items.map((it) =>
        chip({
          label: it.label,
          active: it.value === value,
          onClick: () => {
            if (it.value === value) return;
            value = it.value;
            render();
            cfg.onChange?.(value);
          },
        }),
      ),
    );
  }
  render();
  host.append(row);
  return {
    el: row,
    update: (p: ChipRowUpdate) => {
      if ("items" in p && p.items) items = p.items;
      if ("value" in p) value = p.value;
      render();
    },
    destroy: () => row.remove(),
  };
}
