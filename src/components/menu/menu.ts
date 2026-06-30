/* menu — dropdown with ONE document-level delegated listener (covers every
   trigger, including dynamically rendered ones). mountMenu(host, {trigger,
   items}) where items = [{label, icon?, onSelect, selected?} | {sep:true} |
   {label, heading:true}]. `icon` (a Bootstrap Icons name) renders before the
   label — icon + label, the right pairing for a drawer. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface MenuActionItem {
  label: string;
  icon?: string;
  onSelect?: () => void;
  selected?: boolean;
  sep?: false;
  heading?: false;
}
export interface MenuSepItem {
  sep: true;
}
export interface MenuHeadingItem {
  label: string;
  heading: true;
}
export type MenuItem = MenuActionItem | MenuSepItem | MenuHeadingItem;

export interface MenuCfg {
  /** A DOM node (e.g. from atoms.button()) that toggles the menu. */
  trigger: HTMLElement;
  items?: MenuItem[];
}

export interface MenuUpdate {
  items?: MenuItem[];
}

let delegated = false;

function installDelegation(): void {
  if (delegated) return;
  delegated = true;
  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const trigger = target?.closest("[data-dd]") ?? null;
    const openMenus = document.querySelectorAll(".amu-menu.is-open");
    for (const m of openMenus) {
      if (!trigger || m.previousElementSibling !== trigger) m.classList.remove("is-open");
    }
    if (trigger) {
      const menu = trigger.nextElementSibling;
      if (menu?.classList.contains("amu-menu")) menu.classList.toggle("is-open");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      for (const m of document.querySelectorAll(".amu-menu.is-open")) m.classList.remove("is-open");
    }
  });
}

function isHeading(it: MenuItem): it is MenuHeadingItem {
  return "heading" in it && it.heading === true;
}
function isSep(it: MenuItem): it is MenuSepItem {
  return "sep" in it && it.sep === true;
}

export function mountMenu(host: Element, cfg: MenuCfg): MountHandle<MenuUpdate> {
  installDelegation();
  const wrap = el("div", { class: "amu-menu-wrap" });
  const trigger = cfg.trigger; // a DOM node from atoms.button() etc.
  trigger.setAttribute("data-dd", "");
  const menu = el("div", { class: "amu-menu", role: "menu" });

  function renderItems(items: MenuItem[]): void {
    menu.replaceChildren(
      ...items.map((it) => {
        if (isSep(it)) return el("div", { class: "amu-menu-sep" });
        if (isHeading(it)) return el("div", { class: "amu-menu-label" }, it.label);
        const action = it;
        return el(
          "button",
          {
            class: `amu-menu-item${action.selected ? " is-selected" : ""}`,
            type: "button",
            role: "menuitem",
            onclick: () => {
              menu.classList.remove("is-open");
              action.onSelect?.();
            },
          },
          // icon + label grouped as a left cluster (the item is space-between).
          el(
            "span",
            { class: "amu-menu-item-label" },
            action.icon ? el("i", { class: "amu-menu-item-icon bi " + action.icon }) : null,
            action.label,
          ),
        );
      }),
    );
  }
  renderItems(cfg.items ?? []);

  wrap.append(trigger, menu);
  host.append(wrap);
  return {
    el: wrap,
    update: (partial: MenuUpdate) => {
      if (partial.items) renderItems(partial.items);
    },
    destroy: () => wrap.remove(),
  };
}
