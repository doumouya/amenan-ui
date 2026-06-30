/* topbar — sidebar toggle · centred search slot · per-page nav (as icons) + an
   optional app launcher (far right). Slim: the RBAC-agnostic universals (theme ·
   settings · sign-out · profile) live in the rail footer, so the topbar is pure
   navigation.

   DECOUPLING (AC-H2): NO apps.js. The nav is INJECTED — the consumer passes the
   list of nav items + the active id (no appsFor/pageById). `onToggleRail` (from
   page-assembly) drives the rail's collapse. The centre `search` is an OPTIONAL
   injected element/mount — topbar does NOT hardwire omni (omni is a W5 component);
   the consumer slots whatever search element it wants (or none).

   mountTopbar(host, {
     nav?:    { items: [{ id, label, icon?, href? }], active? },
     onToggleRail?(),
     search?: Node | ((slot) => MountHandle | void),  // optional injected search
     apps?:   { items: [{ id, label, icon? }], onSelect(id), title? },  // launcher
   }) → { el, setActive(id), destroy }

   Composes atoms.button + mountMenu (for the launcher). Sole owner of
   .amu-topbar* (ui-fork-audit R4). */

import { el } from "../../kernel/dom.ts";
import { button } from "../atoms/atoms.ts";
import { mountMenu } from "../menu/menu.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface TopbarNavItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
}

export interface TopbarNav {
  items: TopbarNavItem[];
  active?: string;
}

export interface TopbarAppItem {
  id: string;
  label: string;
  icon?: string;
}

export interface TopbarApps {
  items: TopbarAppItem[];
  onSelect?: (id: string) => void;
  title?: string;
}

/** An injected search mount: append your search element to `slot`, returning an
    optional handle so the topbar can tear it down. */
export type TopbarSearch = Node | ((slot: HTMLElement) => MountHandle | void);

export interface TopbarCfg {
  nav?: TopbarNav;
  onToggleRail?: () => void;
  search?: TopbarSearch;
  apps?: TopbarApps;
}

export interface TopbarHandle extends MountHandle {
  setActive: (id: string) => void;
}

export function mountTopbar(host: Element, cfg: TopbarCfg = {}): TopbarHandle {
  const bar = el("header", { class: "amu-topbar" });

  // lead: the sidebar toggle (opens/closes the rail). Only shown when the page
  // supplies a handler. The grid keeps three columns whether or not it's filled.
  const lead = el("div", { class: "amu-topbar-lead" });
  if (cfg.onToggleRail) {
    lead.append(
      button({
        icon: "bi-layout-sidebar",
        variant: "ghost",
        title: "Toggle sidebar",
        ariaLabel: "Toggle sidebar",
        onClick: cfg.onToggleRail,
      }),
    );
  }
  bar.append(lead);

  // centre: the OPTIONAL injected search slot — topbar never hardwires omni.
  const center = el("div", { class: "amu-topbar-center" });
  bar.append(center);
  let searchHandle: MountHandle | null = null;
  if (typeof cfg.search === "function") {
    searchHandle = cfg.search(center) ?? null;
  } else if (cfg.search) {
    center.append(cfg.search);
  }

  // right cluster: the nav items as ICON links, then an optional app launcher
  // at the far-right end. The universals moved to the rail footer.
  const actions = el("div", { class: "amu-topbar-actions" });
  for (const p of cfg.nav?.items ?? []) {
    actions.append(
      el(
        "a",
        {
          class: `amu-topbar-nav-icon${p.id === cfg.nav?.active ? " is-active" : ""}`,
          "data-nav-id": p.id,
          href: p.href ?? `#/${p.id}`,
          title: p.label,
          "aria-label": p.label,
        },
        el("i", { class: "bi " + (p.icon ?? "bi-square") }),
      ),
    );
  }
  let appsMenu: MountHandle | null = null;
  if (cfg.apps && cfg.apps.items.length) {
    const apps = cfg.apps;
    appsMenu = mountMenu(actions, {
      trigger: button({
        icon: "bi-grid-3x3-gap-fill",
        variant: "ghost",
        title: apps.title ?? "Switch app",
        ariaLabel: apps.title ?? "Switch app",
      }),
      items: apps.items.map((a) => ({
        label: a.label,
        icon: a.icon,
        onSelect: () => apps.onSelect?.(a.id),
      })),
    });
  }
  bar.append(actions);

  host.append(bar);
  return {
    el: bar,
    update() {},
    /** Flip the active nav highlight without a rebuild. */
    setActive: (id: string) => {
      for (const a of actions.querySelectorAll<HTMLElement>(".amu-topbar-nav-icon.is-active")) {
        a.classList.remove("is-active");
      }
      const next = actions.querySelector<HTMLElement>(
        `.amu-topbar-nav-icon[data-nav-id="${cssEscape(id)}"]`,
      );
      next?.classList.add("is-active");
    },
    destroy: () => {
      searchHandle?.destroy?.();
      appsMenu?.destroy?.();
      bar.remove();
    },
  };
}

/** Minimal CSS.escape fallback for the setActive attribute selector. */
function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, "\\$&");
}
