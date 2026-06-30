/* app.ts — AC-K2. The standalone PROOF app: it builds ONE real page with
   assemblePage (a surface + sections + a literal rail) and wires a 2-route
   createRouter (NO guards) to a host node. Navigating between the two routes
   swaps the surface content — proving page-assembly + the router compose with
   ZERO backend couplings (no app-registry hardwire, no login bounce, no server
   rail fetch, no Service required). Everything here is in-memory and synchronous.

   Its host page is app.html (mirrors index.html). esbuild bundles this entry to
   dist/app.js. */

import { el } from "./kernel/dom.ts";
import { assemblePage } from "./page-assembly.ts";
import { createRouter } from "./router.ts";
import { mountSurface } from "./components/surface/surface.ts";
import { mountRail } from "./components/rail/rail.ts";
import type { RailGroupData } from "./components/rail/rail.ts";
import { mountStatStrip } from "./components/stat/stat.ts";
import { mountEmptyState } from "./components/empty-state/empty-state.ts";
import { mountCard } from "./components/card/card.ts";
import type {
  Mount,
  MountCtx,
  MountHandle,
  PageSpec,
  RailGroup,
  RouteMap,
  SurfaceSpec,
} from "./contract/index.ts";

const host = document.querySelector("#app");
if (!host) throw new Error("app: #app host not found");

/* ── region mount adapters (Mount-shaped wrappers over the components) ────── */

/* The surface mount the PageSpec expects (`Mount<SurfaceSpec>`). mountSurface
   takes (host, cfg); we adapt it to (host, ctx, config). The per-section hosts
   are created by page-assembly inside `surface.el`, so the surface only paints
   the title band here. */
const surfaceMount: Mount<SurfaceSpec> = (slot, _ctx, cfg) =>
  mountSurface(slot, {
    ...(cfg?.title !== undefined ? { title: cfg.title } : {}),
    ...(cfg?.meta !== undefined ? { meta: cfg.meta } : {}),
    head: cfg?.head !== false,
  });

/* The rail mount the PageSpec expects (`Mount<{ groups, active?, load? }>`). It
   maps the pure page-spec RailGroup[] onto the rail component's RailGroupData[]
   (groups → tabs). A tab click routes via location.hash → the router re-paints. */
const railMount: Mount<{ groups: RailGroup[]; active?: string }> = (slot, _ctx, cfg) => {
  const groups: RailGroupData[] = (cfg?.groups ?? []).map((g, gi) => ({
    id: `g${gi}`,
    name: g.title ?? `Group ${gi + 1}`,
    tabs: g.items.map((it) => ({
      id: it.id,
      name: it.label,
      icon: "bi-window",
      active: it.id === cfg?.active,
    })),
  }));
  return mountRail(slot, {
    groups,
    on: {
      tab: (tabId) => {
        if (tabId) location.hash = "#/" + tabId;
      },
    },
  }) as MountHandle;
};

/* ── the two routes — each paints a different surface section body ────────── */

type RouteId = "overview" | "files";

function renderOverview(target: HTMLElement): void {
  mountStatStrip(target, {
    stats: [
      { label: "Files", value: 42, tone: "ok" },
      { label: "Avg score", value: "88%", tone: "ok" },
      { label: "At risk", value: 4, tone: "warn" },
    ],
  });
  mountCard(target, { title: "Welcome", sub: "This is the standalone amenan-ui proof app (route: overview)." });
}

function renderFiles(target: HTMLElement): void {
  mountEmptyState(target, {
    title: "Files",
    line: "Two routes, one assemblePage shell, zero backend (route: files).",
    action: { label: "Back to overview", onClick: () => (location.hash = "#/overview") },
  });
}

const PAINTERS: Record<RouteId, (target: HTMLElement) => void> = {
  overview: renderOverview,
  files: renderFiles,
};

/* ── the shared page shell — built ONCE; the router re-paints the section ──── */

const pageSpec: PageSpec = {
  rail: {
    mount: railMount,
    groups: [
      { title: "Views", items: [{ id: "overview", label: "Overview" }, { id: "files", label: "Files" }] },
    ],
    active: "overview",
  },
  surface: {
    mount: surfaceMount,
    title: "amenan-ui",
    meta: "standalone proof",
    sections: [{ key: "main", layout: "fill" }],
  },
};

const ctx: MountCtx = {};
const page = assemblePage(host, pageSpec, ctx);
const main = page.section("main");

/* ── the router — 2 routes, NO guards, wired to the section host ──────────── */

// The route id lives in the map key AND in meta.id, so mount() can pick the
// painter without re-parsing the hash.
const routes: RouteMap = {
  overview: { meta: { id: "overview" } },
  files: { meta: { id: "files" } },
};

const router = createRouter({
  routes,
  resolveLanding: () => "overview",
  // Each navigation re-paints the section host. The returned handle's destroy()
  // clears it before the next route paints.
  mount: (_host, def): MountHandle => {
    const id = (def.meta?.["id"] as RouteId | undefined) ?? "overview";
    if (main) {
      main.replaceChildren();
      PAINTERS[id](main);
    }
    return {
      el: main ?? el("div"),
      destroy: () => main?.replaceChildren(),
    };
  },
});

router.start();
