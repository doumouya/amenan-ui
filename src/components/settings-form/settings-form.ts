/* settings-form — renders REGISTRATIONS, never hand-written forms. Both a
   settings surface (pref registry) and an admin console (policy registry) use
   this one renderer — the "third framework" promise: a knob registered anywhere
   appears here with zero edits to either page.
   mountSettingsForm(host, {defs, get(key), set(key,value)}) — defs from
   listPrefs()/listPolicies(); grouped by def.group in registration order.

   Composes atoms.input + mountField + mountSelect; sole owner of .amu-sform*. */

import { el } from "../../kernel/dom.ts";
import { input } from "../atoms/atoms.ts";
import { mountField } from "../field/field.ts";
import { mountSelect } from "../select/select.ts";
import type { SelectOption } from "../select/select.ts";
import type { PrefDef } from "../../registry/pref-registry.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface SettingsFormCfg {
  defs: PrefDef[];
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

export interface SettingsFormUpdate {
  defs?: PrefDef[];
}

function controlFor(
  def: PrefDef,
  current: unknown,
  set: (key: string, value: unknown) => void,
): Node {
  if (def.control === "select") {
    const host = el("span");
    mountSelect(host, {
      options: (def.options as SelectOption[] | undefined) ?? [],
      value: (current ?? def.default) as string | undefined,
      onChange: (v) => set(def.key, v),
    });
    return host;
  }
  if (def.control === "toggle") {
    const box = el("input", { type: "checkbox" });
    box.checked = Boolean(current ?? def.default ?? false);
    box.addEventListener("change", () => set(def.key, box.checked));
    return box;
  }
  // text (default)
  return input({
    value: String(current ?? def.default ?? ""),
    onEnter: (v) => set(def.key, v),
  });
}

export function mountSettingsForm(
  host: Element,
  cfg: SettingsFormCfg,
): MountHandle<SettingsFormUpdate> {
  let defs = cfg.defs;
  const root = el("div", { class: "amu-sform" });

  function render(): void {
    const groups = new Map<string, PrefDef[]>();
    for (const def of defs) {
      const g = def.group ?? "General";
      let bucket = groups.get(g);
      if (!bucket) {
        bucket = [];
        groups.set(g, bucket);
      }
      bucket.push(def);
    }
    root.replaceChildren(
      ...[...groups.entries()].map(([group, groupDefs]) => {
        const rows = el("div", { class: "amu-sform-rows" });
        for (const def of groupDefs) {
          const row = el("div", { class: "amu-sform-row" });
          mountField(row, {
            label: def.label ?? def.key,
            inline: true,
            bare: true,
            control: controlFor(def, cfg.get(def.key), cfg.set),
          });
          rows.append(row);
        }
        return el(
          "section",
          { class: "amu-sform-group", "data-group": group },
          el("h3", { class: "amu-sform-group-title" }, group),
          rows,
        );
      }),
    );
  }
  render();
  host.append(root);
  return {
    el: root,
    update: (p: SettingsFormUpdate) => {
      if (p.defs) defs = p.defs;
      render();
    },
    destroy: () => root.remove(),
  };
}
