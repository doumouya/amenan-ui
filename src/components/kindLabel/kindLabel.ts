/* kindLabel — a column-type annotation (AC-20), ported from web-kit's `kindLabel`
   to amenan conventions: classes `.amu-kind*` (renamed from the web-kit prefix), a
   co-located CSS sheet `@import`ed by styles.css (NOT `ensureStyles`), built on
   the kernel `el`.

   Renders the datatable-header type tag (Int / Float / Bool / Text). The default
   `text` variant is small muted text beside the column name; the `chip` variant is
   a faint per-kind tinted chip with a tick for denser layouts.

   Sole owner of every .amu-kind* class (ui-fork-audit R4). Scrub-clean. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export type KindLabelKind = "Int" | "Float" | "Bool" | "Text";
export type KindLabelVariant = "text" | "chip";

const KEY: Record<KindLabelKind, string> = {
  Int: "int",
  Float: "float",
  Bool: "bool",
  Text: "text",
};

export interface KindLabelCfg {
  kind?: KindLabelKind;
  variant?: KindLabelVariant;
}

export function mountKindLabel(host: Element, cfg: KindLabelCfg = {}): MountHandle {
  const { kind = "Text", variant = "text" } = cfg;
  const k = KEY[kind];

  let node: HTMLElement;
  if (variant === "chip") {
    node = el(
      "span",
      { class: `amu-kind amu-kind--chip amu-kind--${k}` },
      el("span", { class: "amu-kind-tick", "aria-hidden": "true" }),
      kind,
    );
  } else {
    node = el("span", { class: "amu-kind amu-kind--text-only" }, kind);
  }

  host.appendChild(node);
  return { el: node, update() {}, destroy: () => node.remove() };
}
