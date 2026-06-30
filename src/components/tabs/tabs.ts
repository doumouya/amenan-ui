/* tabs — calm view switcher (AC-20), ported from web-kit's `tabs` to amenan
   conventions: classes `.amu-tabs*` (renamed from the web-kit prefix), a
   co-located CSS sheet `@import`ed by styles.css (NOT `ensureStyles`), built on
   the kernel `el`.

   The underline variant (default) is the quiet in-page switch (list ⇄ board);
   `segmented` is a bordered pill group for compact toolbars. Controlled via
   `value`/`onChange`, or uncontrolled with `defaultValue`. Each item is
   { id, label, icon?, count? }.

   Sole owner of every .amu-tabs* class (ui-fork-audit R4). Scrub-clean. */

import { el } from "../../kernel/dom.ts";
import type { Child } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export type TabsVariant = "underline" | "segmented";

export interface TabItem {
  id: string;
  label: Child;
  icon?: Node;
  count?: number;
}

export interface TabsCfg {
  items: TabItem[];
  /** Controlled active tab id; pair with `onChange`. */
  value?: string;
  /** Initial active tab id when uncontrolled (defaults to the first tab). */
  defaultValue?: string;
  /** Called with the picked tab id on every selection. */
  onChange?: (id: string) => void;
  variant?: TabsVariant;
  block?: boolean;
}

/** The narrow update — drive the active tab from the consumer (controlled). */
export interface TabsUpdate {
  value?: string;
}

export function mountTabs(host: Element, cfg: TabsCfg): MountHandle<TabsUpdate> {
  const { items, value, defaultValue, onChange, variant = "underline", block } = cfg;

  const first = items[0];
  let internal = defaultValue != null ? defaultValue : first ? first.id : undefined;
  let controlled = value;

  const classes = [
    "amu-tabs",
    `amu-tabs--${variant}`,
    block ? "amu-tabs--block" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const root = el("div", { class: classes, role: "tablist" });
  const buttons = new Map<string, HTMLButtonElement>();

  function render(): void {
    const active = controlled != null ? controlled : internal;
    for (const [id, node] of buttons) {
      node.setAttribute("aria-selected", String(active === id));
    }
  }

  function pick(id: string): void {
    if (controlled == null) internal = id;
    onChange?.(id);
    render();
  }

  for (const t of items) {
    const node = el(
      "button",
      {
        class: "amu-tabs-tab",
        role: "tab",
        type: "button",
        onclick: () => pick(t.id),
      },
      t.icon ?? null,
      t.label,
      t.count != null ? el("span", { class: "amu-tabs-count" }, t.count) : null,
    );
    buttons.set(t.id, node);
    root.appendChild(node);
  }

  render();
  host.appendChild(root);
  return {
    el: root,
    update(p: TabsUpdate) {
      if ("value" in p) {
        controlled = p.value;
        render();
      }
    },
    destroy() {
      root.remove();
    },
  };
}
