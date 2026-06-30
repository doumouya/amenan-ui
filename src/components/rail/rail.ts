/* rail — the page's left navigation: a data-driven two-level group/tab strip.
   A group = a container (project / status bucket); a tab = a leaf (file / case).
   The rail owns its own structure + behavior ("lego brick"): pages supply a
   config of data + handlers, the builder emits the whole .amu-rail-* DOM.

   DECOUPLING (AC-H2): UI ONLY — zero fetch, zero api. The data/controller layer
   (loading groups, persisting collapse, theme/signOut/settings routes) is the
   consumer's concern (a separate rail-data controller). This component renders
   the supplied data and reports every interaction through `config.on` callbacks.

   mountRail(host, config) → { el, setGroups(groups, hidden?, emptyText?),
                               setActive(id), toggleCollapse(want?), destroy() }

   Composes atoms.button/input rather than re-declaring their classes — every
   .amu-rail-* class is owned solely by rail.css (ui-fork-audit R4). Collapse to
   the icon-rail (`.compact`) is driven from OUTSIDE via the handle's
   toggleCollapse (the topbar's sidebar button); the @media overlay drawer in
   rail.css is a separate narrow-viewport behavior. */

import { el, esc } from "../../kernel/dom.ts";
import { button, input } from "../atoms/atoms.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface RailTabAction {
  action: string;
  icon?: string;
  title?: string;
  /** A class suffix override (defaults to the action name). */
  cls?: string;
}

export interface RailTab {
  id?: string;
  name?: string;
  icon?: string;
  dot?: string;
  active?: boolean;
  renamable?: boolean;
  hidable?: boolean;
  title?: string;
  actions?: RailTabAction[];
}

export interface RailGroupData {
  id?: string;
  name?: string;
  /** A colour for the group mark chip (hex or var(--…)). */
  mark?: string;
  /** Explicit mark initials (else derived from the name). */
  initials?: string;
  count?: number;
  collapsed?: boolean;
  renamable?: boolean;
  hidable?: boolean;
  addLabel?: string;
  tabs?: RailTab[];
}

export interface RailHiddenItem {
  id?: string;
  kind?: string;
  name?: string;
  meta?: string;
}

export interface RailHiddenSection {
  title?: string;
  items?: RailHiddenItem[];
}

export interface RailSearchCfg {
  placeholder?: string;
  onInput?: (q: string) => void;
}

export interface RailOverviewCfg {
  label?: string;
  icon?: string;
  active?: boolean;
}

export interface RailUniversals {
  profileInitials?: string;
  themeLabel?: string;
  activeId?: string;
}

export interface RailFooterCfg {
  create?: { label?: string };
  universals?: RailUniversals;
}

/** A custom per-row / per-group action handler (a tab's `actions` entry), keyed
    by action name in `RailHandlers.custom`. */
export type RailCustomHandler = (
  tabId: string | undefined,
  groupId: string | undefined,
) => void;

/** The interaction callbacks. The named handlers are the universals; any other
    action (a tab's custom `action`, e.g. "visualize") is dispatched through the
    typed `custom` record — kept separate so the named handlers stay precisely
    typed (a string index signature would have to flatten them). */
export interface RailHandlers {
  tab?: (tabId: string | undefined, groupId: string | undefined) => void;
  tabRename?: (tabId: string | undefined, value: string) => void;
  tabHide?: (tabId: string | undefined) => void;
  groupToggle?: (groupId: string | undefined, collapsed: boolean) => void;
  groupRename?: (groupId: string | undefined, value: string) => void;
  groupHide?: (groupId: string | undefined) => void;
  groupAdd?: (groupId: string | undefined) => void;
  overview?: () => void;
  restore?: (id: string | undefined, kind: string | undefined) => void;
  create?: () => void;
  theme?: () => void;
  settings?: () => void;
  signOut?: () => void;
  profile?: () => void;
  collapseToggle?: (collapsed: boolean) => void;
  /** Custom per-row / per-group actions, dispatched by action name. */
  custom?: Record<string, RailCustomHandler | undefined>;
}

export interface RailConfig {
  title?: string;
  collapsed?: boolean;
  search?: RailSearchCfg;
  overview?: RailOverviewCfg;
  groups?: RailGroupData[];
  hidden?: RailHiddenSection[];
  footer?: RailFooterCfg;
  on?: RailHandlers;
}

export interface RailHandle extends MountHandle {
  setGroups: (
    groups: RailGroupData[],
    hidden?: RailHiddenSection[],
    emptyText?: string,
  ) => void;
  setActive: (id: string | undefined) => void;
  toggleCollapse: (want?: boolean) => boolean;
}

interface SearchMatch {
  el: HTMLElement | null;
  name: string;
  kind: "group" | "tab";
}

/** Build + wire the rail into `host`. `host` is the page slot; the rail's own
    `<aside class="amu-rail">` is created inside it and returned as `el`. */
export function mountRail(host: Element, config: RailConfig = {}): RailHandle {
  const on: RailHandlers = config.on ?? {};

  const rail = el("aside", { class: "amu-rail" + (config.collapsed ? " compact" : "") });

  // ── static chrome (search) — built once, never re-rendered. No title: the
  //    page name lives in the topbar, so the rail goes straight to its content.
  if (config.search) rail.append(searchEl(config));

  // ── body (overview + groups + hidden) — re-rendered by setGroups ───────────
  const body = el("div", { class: "amu-rail-body" });
  rail.append(body);
  renderBody(body, config, config.groups ?? [], config.hidden, null);

  // ── footer (create + universals) — built once ──────────────────────────────
  if (config.footer) rail.append(footerEl(config));

  // Collapse to/from the icon-only strip. `want` omitted ⇒ toggle. Reports the
  // new state (the consumer persists it). The topbar's sidebar button drives
  // this via the handle's toggleCollapse — the rail has no chevron of its own.
  function setCompact(want?: boolean): boolean {
    const isCompact = want ?? !rail.classList.contains("compact");
    rail.classList.toggle("compact", isCompact);
    on.collapseToggle?.(isCompact);
    return isCompact;
  }

  // ── narrow-viewport drawer (≤ --bp-md, 64rem): the SAME topbar sidebar toggle
  //    opens the rail as an off-canvas drawer + scrim here, instead of the
  //    desktop icon-rail. matchMedia is event-driven; classList only. The drawer
  //    state is transient — it is NOT persisted as rail.collapsed. ─────────────
  const narrow = window.matchMedia("(max-width: 64rem)"); // --bp-md
  const scrim = el("div", { class: "amu-rail-scrim" });
  const setDrawer = (open: boolean): void => {
    rail.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
  };
  scrim.addEventListener("click", () => setDrawer(false));
  // Crossing back to wide drops any drawer state (the rail becomes the sidebar).
  const onNarrowChange = (e: MediaQueryListEvent): void => {
    if (!e.matches) setDrawer(false);
  };
  narrow.addEventListener("change", onNarrowChange);
  // After a navigation in drawer mode, close so the surface is visible.
  const closeDrawerIfNarrow = (): void => {
    if (narrow.matches) setDrawer(false);
  };

  // ── ONE delegated click handler, routed by data-rail-action. Survives the
  //    wholesale body re-render in setGroups because it lives on the root. ─────
  rail.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const elx = target?.closest<HTMLElement>("[data-rail-action]");
    if (!elx || !rail.contains(elx)) return;
    const action = elx.dataset.railAction ?? "";

    const tabEl = elx.closest<HTMLElement>(".amu-rail-tab");
    const groupEl = elx.closest<HTMLElement>(".amu-rail-group");
    const tabId = tabEl?.dataset.tabId;
    const groupId = groupEl?.dataset.groupId;

    switch (action) {
      case "overview":
        e.preventDefault();
        on.overview?.();
        closeDrawerIfNarrow();
        return;
      case "group-toggle": {
        e.preventDefault();
        // rail.css shows the body via `.expanded`; toggling reports the new
        // *collapsed* state (the inverse of expanded) to the orchestrator.
        const expanded = groupEl?.classList.toggle("expanded") ?? false;
        on.groupToggle?.(groupId, !expanded);
        return;
      }
      case "group-rename":
        e.stopPropagation();
        inlineRename(groupEl?.querySelector<HTMLElement>(".amu-rail-group-name") ?? null, (v) =>
          on.groupRename?.(groupId, v),
        );
        return;
      case "group-hide":
        e.stopPropagation();
        on.groupHide?.(groupId);
        return;
      case "group-add":
        e.stopPropagation();
        on.groupAdd?.(groupId);
        return;
      case "tab":
        e.preventDefault();
        on.tab?.(tabId, groupId);
        closeDrawerIfNarrow();
        return;
      case "tab-rename":
        e.stopPropagation();
        inlineRename(tabEl?.querySelector<HTMLElement>(".amu-rail-tab-name") ?? null, (v) =>
          on.tabRename?.(tabId, v),
        );
        return;
      case "tab-hide":
        e.stopPropagation();
        on.tabHide?.(tabId);
        return;
      case "restore":
        e.preventDefault();
        on.restore?.(elx.dataset.restoreId, elx.dataset.restoreKind);
        return;
      case "create":
        on.create?.();
        return;
      case "theme":
        on.theme?.();
        return;
      case "settings":
        on.settings?.();
        return;
      case "signOut":
        on.signOut?.();
        return;
      case "profile":
        on.profile?.();
        return;
      // Custom per-row / per-group actions (e.g. a tab's "visualize"): listed in
      // a tab's `actions`, dispatched by action name to on.custom[action].
      default: {
        e.stopPropagation();
        on.custom?.[action]?.(tabId, groupId);
      }
    }
  });

  // ── search wiring: live filter + inline auto-complete with ↑↓ match cycling ─
  const searchBox = rail.querySelector<HTMLElement>(".amu-rail-search");
  const searchInput = searchBox?.querySelector("input") ?? null;
  const searchInputCb = config.search?.onInput;
  if (searchInput && searchInputCb) {
    let typedPrefix = ""; // what the user actually typed (drives the completion)
    let matchEls: SearchMatch[] = []; // prefix matches, DOM order
    let cursor = -1;

    const collectMatches = (prefix: string): SearchMatch[] => {
      const p = prefix.toLowerCase();
      const out: SearchMatch[] = [];
      if (!p) return out;
      for (const g of rail.querySelectorAll<HTMLElement>(".amu-rail-body > .amu-rail-group")) {
        const gn = g.querySelector(".amu-rail-group-name")?.textContent ?? "";
        if (gn.toLowerCase().startsWith(p)) {
          out.push({ el: g.querySelector<HTMLElement>(".amu-rail-group-head"), name: gn, kind: "group" });
        }
        for (const t of g.querySelectorAll<HTMLElement>(".amu-rail-tab")) {
          const tn = t.querySelector(".amu-rail-tab-name")?.textContent ?? "";
          if (tn.toLowerCase().startsWith(p)) out.push({ el: t, name: tn, kind: "tab" });
        }
      }
      return out;
    };

    const clearCursor = (): void =>
      rail
        .querySelector(".amu-rail-tab.is-cursor, .amu-rail-group-head.is-cursor")
        ?.classList.remove("is-cursor");

    const paintCursor = (): void => {
      clearCursor();
      if (cursor < 0 || cursor >= matchEls.length) return;
      const m = matchEls[cursor];
      if (!m) return;
      m.el?.classList.add("is-cursor");
      m.el?.scrollIntoView({ block: "nearest" });
      if (m.name.length > typedPrefix.length) {
        searchInput.value = typedPrefix + m.name.slice(typedPrefix.length); // keep typed case
        searchInput.setSelectionRange(typedPrefix.length, m.name.length);
      }
    };

    searchInput.addEventListener("input", (e) => {
      typedPrefix = searchInput.value;
      searchInputCb(typedPrefix.trim()); // filters + re-renders the tree
      matchEls = collectMatches(typedPrefix.trim());
      // complete to the first match on FORWARD typing only (never delete/paste).
      const inputType = e instanceof InputEvent ? e.inputType : "";
      cursor = inputType === "insertText" && matchEls.length ? 0 : -1;
      paintCursor();
    });

    searchInput.addEventListener("keydown", (e) => {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && matchEls.length) {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        cursor =
          cursor < 0
            ? step > 0
              ? 0
              : matchEls.length - 1
            : (cursor + step + matchEls.length) % matchEls.length;
        paintCursor();
      } else if (e.key === "Enter" && cursor >= 0 && matchEls[cursor]) {
        e.preventDefault();
        // a leaf (file) opens via its delegated click; a group has no open
        // action — the completion already named it and the list is narrowed.
        const m = matchEls[cursor];
        if (m && m.kind === "tab") m.el?.click();
      } else if (e.key === "Escape") {
        clearCursor();
        cursor = -1;
        searchInput.blur();
      }
    });

    searchInput.addEventListener("blur", clearCursor);
  }
  // In the collapsed icon-rail the field is hidden and only the search icon
  // shows; clicking it expands the rail and focuses the field.
  searchBox?.addEventListener("click", () => {
    if (!rail.classList.contains("compact")) return;
    setCompact(false);
    searchInput?.focus();
  });

  host.append(rail);
  host.append(scrim);

  return {
    el: rail,
    /** Re-render the body (overview + groups + hidden) in place after a data
        change. `emptyText` shows a `.amu-rail-state` line when groups is empty. */
    setGroups(groups: RailGroupData[], hidden?: RailHiddenSection[], emptyText?: string): void {
      renderBody(body, config, groups ?? [], hidden, emptyText ?? null);
    },
    /** Open/close the rail from outside (the topbar's sidebar toggle). Below
        --bp-md it drives the off-canvas DRAWER (transient); above, the desktop
        `.compact` icon-rail (persisted). `want` omitted ⇒ toggle. */
    toggleCollapse(want?: boolean): boolean {
      if (narrow.matches) {
        const open = want ?? !rail.classList.contains("is-open");
        setDrawer(open);
        return open;
      }
      return setCompact(want);
    },
    /** Flip the active tab highlight without a full rebuild. */
    setActive(id: string | undefined): void {
      for (const t of rail.querySelectorAll(".amu-rail-tab.active")) {
        t.classList.remove("active");
      }
      const next = rail.querySelector(`.amu-rail-tab[data-tab-id="${cssEscape(String(id ?? ""))}"]`);
      next?.classList.add("active");
    },
    destroy(): void {
      narrow.removeEventListener("change", onNarrowChange);
      scrim.remove();
      rail.remove();
    },
  };
}

// ── body renderer (overview + groups + hidden), used on mount + setGroups ────
function renderBody(
  body: HTMLElement,
  config: RailConfig,
  groups: RailGroupData[],
  hidden: RailHiddenSection[] | undefined,
  emptyText: string | null,
): void {
  const children: (Node | null)[] = [];
  if (config.overview) children.push(overviewEl(config.overview));
  for (const g of groups) children.push(groupEl(g));
  if (!groups.length && emptyText) {
    children.push(el("div", { class: "amu-rail-state" }, emptyText));
  }
  const hiddenEl = hidden ?? config.hidden;
  if (hiddenEl?.length) children.push(hiddenDrawerEl(hiddenEl));
  body.replaceChildren(...children.filter((c): c is Node => c != null));
}

// ── search: composes the input atom inside a rail-owned wrapper ──────────────
function searchEl(c: RailConfig): HTMLElement {
  const box = el(
    "div",
    { class: "amu-rail-search" },
    el("i", { class: "bi bi-search amu-rail-search-icon" }),
    input({ type: "search", placeholder: c.search?.placeholder ?? "Filter…" }),
  );
  return el("div", { class: "amu-rail-filter" }, box);
}

// ── overview: a pinned pseudo-tab above the groups ───────────────────────────
function overviewEl(o: RailOverviewCfg): HTMLElement {
  return el(
    "div",
    { class: "amu-rail-overview" },
    el(
      "button",
      {
        class: "amu-rail-tab" + (o.active ? " active" : ""),
        type: "button",
        "data-rail-action": "overview",
      },
      el("i", { class: "amu-rail-tab-icon bi " + (o.icon ?? "bi-grid-1x2") }),
      el("span", { class: "amu-rail-tab-name" }, o.label ?? "Overview"),
    ),
  );
}

// ── group: caret + mark + name + count + rename/hide affordances + tabs ──────
function markInitials(g: RailGroupData): string {
  if (g.initials) return g.initials;
  return (
    ((g.name ?? "?")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("") || "?")
      .slice(0, 2)
      .toUpperCase()
  );
}

function groupEl(g: RailGroupData): HTMLElement {
  const head = el(
    "div",
    {
      class: "amu-rail-group-head",
      "data-rail-action": "group-toggle",
    },
    el("i", { class: "amu-rail-group-caret bi bi-chevron-down" }),
    g.mark
      ? el(
          "span",
          { class: "amu-rail-group-mark", style: "--mark:" + esc(g.mark) },
          markInitials(g),
        )
      : null,
    el("span", { class: "amu-rail-group-name" }, g.name ?? ""),
    Number.isFinite(g.count)
      ? el("span", { class: "amu-rail-group-count" }, String(g.count))
      : null,
    g.renamable ? affordance("amu-rail-group-rename", "group-rename", "bi-pencil", "Rename") : null,
    g.hidable ? affordance("amu-rail-group-hide", "group-hide", "bi-eye-slash", "Hide") : null,
  );

  const tabs: HTMLElement[] = (g.tabs ?? []).map(tabEl);
  if (g.addLabel) {
    tabs.push(
      el(
        "button",
        {
          class: "amu-rail-group-add",
          type: "button",
          "data-rail-action": "group-add",
        },
        el("i", { class: "bi bi-plus" }),
        g.addLabel,
      ),
    );
  }

  // `.expanded` shows the body (rail.css); default to expanded, omit when collapsed.
  return el(
    "div",
    {
      class: "amu-rail-group" + (g.collapsed ? "" : " expanded"),
      "data-group-id": esc(g.id ?? ""),
    },
    head,
    el("div", { class: "amu-rail-group-body" }, ...tabs),
  );
}

// ── tab: icon + name + per-row actions + dot + rename/hide affordances ───────
function tabEl(t: RailTab): HTMLElement {
  const actions = (t.actions ?? []).map((a) =>
    el(
      "span",
      {
        class: "amu-rail-tab-" + (a.cls ?? a.action),
        "data-rail-action": a.action,
        title: a.title ?? "",
      },
      el("i", { class: "bi " + (a.icon ?? "") }),
    ),
  );

  return el(
    "button",
    {
      class: "amu-rail-tab" + (t.active ? " active" : ""),
      type: "button",
      "data-rail-action": "tab",
      "data-tab-id": esc(t.id ?? ""),
      title: t.title ?? null,
    },
    el("i", { class: "amu-rail-tab-icon bi " + (t.icon ?? "bi-file-earmark") }),
    el("span", { class: "amu-rail-tab-name" }, t.name ?? ""),
    ...actions,
    t.dot ? el("span", { class: "amu-rail-tab-dot " + t.dot }) : null,
    t.renamable ? affordance("amu-rail-tab-rename", "tab-rename", "bi-pencil", "Rename") : null,
    t.hidable ? affordance("amu-rail-tab-hide", "tab-hide", "bi-x", "Hide") : null,
  );
}

// Bare <span> affordance (NOT <button> — the tab is itself a button; nested
// buttons are invalid). Hover-fades in via rail.css.
function affordance(cls: string, action: string, icon: string, title: string): HTMLElement {
  return el(
    "span",
    { class: cls, "data-rail-action": action, title },
    el("i", { class: "bi " + icon }),
  );
}

// ── "Hidden (N)" restore drawer ──────────────────────────────────────────────
function hiddenDrawerEl(hidden: RailHiddenSection[]): HTMLElement {
  const count = hidden.reduce((n, s) => n + (s.items?.length ?? 0), 0);
  const sections = hidden.map((s) =>
    el(
      "div",
      { class: "amu-rail-hidden-section" },
      s.title ? el("div", { class: "amu-rail-hidden-title" }, s.title) : null,
      ...(s.items ?? []).map((it) =>
        el(
          "button",
          {
            class: "amu-rail-hidden-item",
            type: "button",
            "data-rail-action": "restore",
            "data-restore-id": esc(it.id ?? ""),
            "data-restore-kind": esc(it.kind ?? ""),
          },
          el("span", { class: "amu-rail-hidden-name" }, it.name ?? ""),
          it.meta ? el("span", { class: "amu-rail-hidden-meta" }, it.meta) : null,
          el("i", { class: "amu-rail-hidden-restore bi bi-arrow-counterclockwise" }),
        ),
      ),
    ),
  );
  return el(
    "details",
    { class: "amu-rail-hidden" },
    el(
      "summary",
      { class: "amu-rail-hidden-summary" },
      el("i", { class: "bi bi-eye-slash" }),
      " Hidden (" + count + ")",
    ),
    el("div", { class: "amu-rail-hidden-body" }, ...sections),
  );
}

// ── footer: contextual create button + the universals cluster ────────────────
function footerEl(c: RailConfig): HTMLElement {
  const f = c.footer ?? {};
  const children: Node[] = [];

  if (f.create) {
    const create = button({ label: f.create.label ?? "Create", variant: "accent" });
    create.classList.add("amu-rail-footer-create");
    create.dataset.railAction = "create";
    // The delegated root handler owns the click; the atom's own onClick is unset.
    children.push(create);
  }

  if (f.universals) {
    children.push(universalsEl(f.universals));
  }

  return el("div", { class: "amu-rail-footer" }, ...children);
}

function universalsEl(u: RailUniversals): HTMLElement {
  const active = u.activeId;
  const item = (id: string, icon: string, title: string): HTMLElement =>
    el(
      "button",
      {
        class: "amu-rail-footer-nav-item" + (active === id ? " is-active" : ""),
        type: "button",
        "data-rail-action": id,
        title,
        "aria-label": title,
      },
      el("i", { class: "bi " + icon }),
    );

  const profile = el(
    "button",
    {
      class:
        "amu-rail-footer-nav-item amu-rail-footer-nav-avatar" +
        (active === "profile" ? " is-active" : ""),
      type: "button",
      "data-rail-action": "profile",
      title: "Profile",
      "aria-label": "Profile",
    },
    u.profileInitials ?? "··",
  );

  return el(
    "div",
    {
      class: "amu-rail-footer-nav",
      role: "navigation",
      "aria-label": "Utility",
    },
    profile,
    item("settings", "bi-gear", "Settings"),
    item("theme", "bi-circle-half", u.themeLabel ?? "Theme"),
    item("signOut", "bi-box-arrow-right", "Sign out"),
  );
}

// ── inline rename — swaps the name span for an input, commits on Enter/blur,
//    reverts on Esc; empty/unchanged reverts silently. (Ported verbatim.) ─────
function inlineRename(nameEl: HTMLElement | null, onCommit: (value: string) => void): void {
  if (!nameEl || nameEl.querySelector("input")) return;
  const current = nameEl.textContent ?? "";
  const isTab = nameEl.classList.contains("amu-rail-tab-name");
  nameEl.classList.add(isTab ? "amu-rail-tab-name-editing" : "amu-rail-group-name-editing");

  const field = el("input", { type: "text" });
  field.value = current;
  nameEl.replaceChildren(field);
  field.focus();
  field.select();

  let done = false;
  const commit = (save: boolean): void => {
    if (done) return;
    done = true;
    const value = field.value.trim();
    nameEl.classList.remove("amu-rail-tab-name-editing", "amu-rail-group-name-editing");
    nameEl.textContent = save && value ? value : current;
    if (save && value && value !== current) onCommit(value);
  };
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      commit(false);
    }
  });
  field.addEventListener("blur", () => commit(true));
}

// Minimal CSS.escape fallback for the setActive attribute selector (ids are
// app-controlled tokens, but quote-safe just in case).
function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, "\\$&");
}
