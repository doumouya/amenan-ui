/* rail-data — the CONTROLLER behind the rail. It wraps the W4b `mountRail` UI
   component with a DATA layer + the universal footer actions, and layers the
   LOCAL view state the data tree doesn't carry (the per-user hide set + restore
   drawer, a client-side name filter, the deterministic initials marks).

   DECOUPLING (AC-H3): every coupling of the source framework's rail-data becomes
   an INJECTED seam:
     · the server rail-tree fetch → `config.load(query)` / `config.source` (an
       async loader the consumer wires to its own transport) — no global fetch
       wrapper, no server-path literal, no fetch here.
     · the hardcoded theme/settings/profile/signOut ROUTES (a `location.hash`
       write) → injected `config.onTheme` / `config.onNavigate(target)` /
       `config.onSignOut` callbacks — NO `location.hash` route hardwiring.
     · the inline-rename server write → `config.onRename(kind, id, value)`.
     · a tab click's default route dispatch → `config.onNavigate({ tab })` (or the
       consumer's own `config.onAction`).
   Collapse + hide persistence is the consumer's concern via `config.persist`
   (was a hardcoded setPref → server write).

   Composes the W4b `mountRail` (it does NOT redeclare any .amu-rail* class — rail
   is the sole owner; rail-data has NO css). It augments mountRail's handle with
   `refresh()` (re-pull the tree in place) and `setActive(id)`.

   mountRailData(host, config) → RailHandle & { refresh(view?), setActive(id) } */

import { mountRail } from "./rail.ts";
import type {
  RailConfig,
  RailGroupData,
  RailHandle,
  RailHiddenSection,
  RailOverviewCfg,
  RailSearchCfg,
  RailTab,
} from "./rail.ts";
import type { Source } from "../../contract/index.ts";

/** The tree the loader resolves: groups → tabs (the data the rail renders). */
export interface RailTree {
  groups?: RailGroupData[];
}

/** A tab as the controller sees it on a navigate dispatch (id + its kind so the
    consumer can route by kind — file/type/instance — without a hardcoded map). */
export interface RailNavTab {
  id: string | undefined;
  kind?: string;
  groupId?: string | undefined;
}

/** Persist a piece of per-user rail UI state (collapse bool / hidden id list).
    Injected so the controller never reaches a transport directly. */
export type RailPersist = (key: string, value: unknown) => void;

export interface RailDataConfig {
  /** The injected async loader — `load(query)` → the rail tree. Replaces the
      source framework's server rail-tree fetch. Either `load` or `source`. */
  load?: Source<RailTree>;
  /** Alias of `load` (a plain `Source<RailTree>`). One of `load`/`source`. */
  source?: Source<RailTree>;
  /** A query passed to the loader (e.g. `{ view: activePageId }`). */
  query?: Record<string, unknown>;

  /** The active tab id (highlight). */
  active?: string;
  /** An optional pinned Overview pseudo-tab + its select handler. */
  overview?: RailOverviewCfg & { onSelect?: () => void };
  /** The client-side name filter; `false` suppresses it, an object overrides it.
      Default: a "Filter…" box that narrows the loaded tree. */
  search?: RailSearchCfg | false;
  /** Initial collapsed state (the consumer reads its own persisted value). */
  collapsed?: boolean;
  /** The per-user hidden-id list (the consumer reads its own persisted value). */
  hidden?: string[];

  /** A tab click — the consumer routes by `tab.kind` (no hardcoded location.hash). */
  onNavigate?: (tab: RailNavTab) => void;
  /** A generic action passthrough (a tab's custom `action`, e.g. "visualize"). */
  onAction?: (action: string, tabId: string | undefined, groupId: string | undefined) => void;
  /** Inline rename commit — `onRename("project"|"file", id, value)` (was PATCH). */
  onRename?: (kind: "project" | "file", id: string | undefined, value: string) => void;
  /** The universal "theme" footer action (was setPref theme toggle). */
  onTheme?: () => void;
  /** The universal "settings"/"profile" footer actions route here (was
      `location.hash="#/settings"`). The consumer decides the destination. */
  onNavigateUniversal?: (target: "settings" | "profile") => void;
  /** The universal "sign out" footer action (was POST /auth/logout + reload). */
  onSignOut?: () => void;
  /** Persist collapse + hidden UI state (was setPref → PUT /settings). */
  persist?: RailPersist;

  /** The footer universals chrome (profile initials + theme label). */
  profileInitials?: string;
  themeLabel?: string;
}

/** The controller handle: the rail handle + the in-place refresh + setActive. */
export interface RailDataHandle extends RailHandle {
  /** Re-pull the rail tree in place (after a create/rename/delete). */
  refresh: () => void;
}

const COLLAPSED_KEY = "rail.collapsed";
const HIDDEN_KEY = "rail.hidden";

/* Stable per-group accent for the initials mark. The hash is deterministic so a
   group keeps its colour across reloads; the palette reads on both themes. */
const MARK_PALETTE = ["#6366f1", "#0ea5e9", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6"];
function markFor(id: string): string {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return MARK_PALETTE[Math.abs(h) % MARK_PALETTE.length] ?? MARK_PALETTE[0]!;
}

export function mountRailData(host: Element, config: RailDataConfig): RailDataHandle {
  const loader = config.load ?? config.source;

  let tree: RailTree = { groups: [] };
  let query = "";
  const hidden = new Set(config.hidden ?? []);

  const allTabs = (): RailTab[] => (tree.groups ?? []).flatMap((g) => g.tabs ?? []);
  const findTab = (id: string | undefined, groupId?: string | undefined): RailTab | null => {
    const groups = tree.groups ?? [];
    const inGroup = groupId ? groups.find((g) => g.id === groupId) : undefined;
    return (
      (inGroup?.tabs ?? []).find((t) => t.id === id) ??
      allTabs().find((t) => t.id === id) ??
      null
    );
  };

  // Re-derive the rendered tree from the data tree + hide set + name filter, then
  // hand it to the component. Called on load and after any local-state change.
  const render = (): void => {
    const q = query.toLowerCase();
    const visible: RailGroupData[] = [];
    const hiddenGroups: { id: string; kind: string; name?: string }[] = [];
    const hiddenTabs: { id: string; kind: string; name?: string; meta?: string }[] = [];

    for (const g of tree.groups ?? []) {
      if (g.id && hidden.has(g.id)) {
        hiddenGroups.push({ id: g.id, kind: "group", name: g.name });
        continue;
      }
      const kept = (g.tabs ?? []).filter((t) => {
        if (t.id && hidden.has(t.id)) {
          hiddenTabs.push({ id: t.id, kind: "tab", name: t.name, meta: g.name });
          return false;
        }
        return true;
      });
      const gMatch = !q || (g.name ?? "").toLowerCase().includes(q);
      const tabs = gMatch ? kept : kept.filter((t) => (t.name ?? "").toLowerCase().includes(q));
      if (q && !gMatch && !tabs.length) continue;
      visible.push({
        ...g,
        mark: g.renamable && g.id ? markFor(g.id) : g.mark,
        tabs,
      });
    }

    const sections: RailHiddenSection[] = [];
    if (hiddenGroups.length) sections.push({ title: "Hidden projects", items: hiddenGroups });
    if (hiddenTabs.length) sections.push({ title: "Hidden files", items: hiddenTabs });
    const empty = q ? `No matches for “${query}”.` : "Nothing here yet.";
    handle.setGroups(visible, sections.length ? sections : undefined, empty);
    if (config.active) handle.setActive(config.active);
  };

  const hide = (id: string | undefined): void => {
    if (!id || hidden.has(id)) return;
    hidden.add(id);
    config.persist?.(HIDDEN_KEY, [...hidden]);
    render();
  };
  const restore = (id: string | undefined): void => {
    if (!id) return;
    hidden.delete(id);
    config.persist?.(HIDDEN_KEY, [...hidden]);
    render();
  };

  // Inline rename: paint the new name optimistically, then hand the commit to the
  // injected callback (the consumer PATCHes + invalidates its own cache).
  const rename = (kind: "project" | "file", id: string | undefined, value: string): void => {
    const target =
      kind === "project" ? (tree.groups ?? []).find((g) => g.id === id) : findTab(id);
    if (target) target.name = value;
    render();
    config.onRename?.(kind, id, value);
  };

  const searchCfg: RailSearchCfg | undefined =
    config.search === false
      ? undefined
      : config.search ?? {
          placeholder: "Filter…",
          onInput: (q: string) => {
            query = q;
            render();
          },
        };

  const handle = mountRail(host, {
    collapsed: config.collapsed ?? false,
    overview: config.overview
      ? { label: config.overview.label, icon: config.overview.icon, active: config.overview.active }
      : undefined,
    search: searchCfg,
    // Footer is UNIVERSALS-ONLY by design (create lives in the toolbar "+").
    footer: {
      universals: {
        themeLabel: config.themeLabel,
        profileInitials: config.profileInitials,
        activeId: config.active,
      },
    },
    groups: [],
    on: {
      tab: (tabId, groupId) => {
        const tab = findTab(tabId, groupId);
        config.onNavigate?.({ id: tabId, kind: tab?.dot ? undefined : tabKind(tab), groupId });
      },
      overview: config.overview?.onSelect,
      collapseToggle: (isCompact) => config.persist?.(COLLAPSED_KEY, isCompact),
      groupRename: (id, val) => rename("project", id, val),
      tabRename: (id, val) => rename("file", id, val),
      groupHide: (id) => hide(id),
      tabHide: (id) => hide(id),
      restore: (id) => restore(id),
      theme: () => config.onTheme?.(),
      settings: () => config.onNavigateUniversal?.("settings"),
      profile: () => config.onNavigateUniversal?.("profile"),
      signOut: () => config.onSignOut?.(),
      custom: config.onAction
        ? new Proxy({} as Record<string, (t: string | undefined, g: string | undefined) => void>, {
            get: (_t, action: string) => (tabId: string | undefined, groupId: string | undefined) =>
              config.onAction?.(action, tabId, groupId),
          })
        : undefined,
    },
  } satisfies RailConfig);

  const reload = (): void => {
    if (!loader) {
      render();
      return;
    }
    loader(config.query).then(
      (t) => {
        tree = t ?? { groups: [] };
        render();
      },
      () => handle.setGroups([], undefined, "Couldn't load the rail."),
    );
  };

  reload();

  return {
    ...handle,
    refresh: reload,
  };
}

/** A tab's kind passthrough (the rail's RailTab has no `kind` field; the consumer
    encodes kind elsewhere). Returns undefined — the consumer routes by id/context.
    Kept as a seam so a future RailTab `kind` can flow through unchanged. */
function tabKind(tab: RailTab | null): string | undefined {
  if (!tab) return undefined;
  const k = (tab as RailTab & { kind?: string }).kind;
  return typeof k === "string" ? k : undefined;
}
