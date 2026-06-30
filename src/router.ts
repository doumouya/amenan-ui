/* router.ts — a generic hash router over a RouteMap. NO app registry, NO
   login bounce, NO page-convention fetch (those were upstream couplings): the
   three hardcoded gates become a consumer GUARD chain, and route loading is the
   consumer's `mount` (+ an injected `loadModule` so the route load step is
   hermetically testable). Per AC-D4/AC-G1.

   Hash parse: (location.hash||"").replace(/^#\//,"").split("?")[0]. */

import type {
  Guard,
  MountCtx,
  MountHandle,
  RouteCtx,
  RouteDef,
  RouteMap,
  Router,
} from "./contract/index.ts";
import { captureMountError } from "./kernel/events.ts";

export interface RouterConfig {
  routes: RouteMap;
  mount(host: Element, def: RouteDef, ctx: MountCtx): Promise<MountHandle | void> | MountHandle | void;
  guards?: Guard[];
  resolveLanding(ctx: RouteCtx): string;
  notFound?(ctx: RouteCtx): string | void;
  loadModule?(path: string): Promise<unknown>;
  host?: Element;
  buildCtx?(id: string): MountCtx & RouteCtx;
}

/** Parse the current route id from the hash (prefix + querystring stripped). */
function routeId(): string {
  return (location.hash || "").replace(/^#\//, "").split("?")[0] ?? "";
}

export function createRouter(cfg: RouterConfig): Router {
  let current: MountHandle | null = null;

  function host(): Element {
    return cfg.host ?? (document.querySelector("#app") as Element);
  }

  function ctxFor(id: string): MountCtx & RouteCtx {
    return cfg.buildCtx ? cfg.buildCtx(id) : {};
  }

  async function navigate(): Promise<void> {
    const id = routeId();
    const ctx = ctxFor(id);

    // Guard chain: the first guard returning a non-null id redirects + aborts.
    for (const guard of cfg.guards ?? []) {
      const redirect = guard(id, ctx);
      if (redirect != null) {
        location.hash = "#/" + redirect;
        return;
      }
    }

    const def = cfg.routes[id];

    // Unknown route → notFound hook, then land.
    if (!def) {
      cfg.notFound?.(ctx);
      const landing = cfg.resolveLanding(ctx);
      location.hash = "#/" + landing;
      return;
    }

    // Tear down the previous handle (a failing destroy must not block nav, and
    // must not silently vanish — record it like a mount failure).
    try {
      current?.destroy?.();
    } catch (err) {
      captureMountError(id, err);
    }
    current = null;

    // Optional injected module load (the consumer's lazy-load seam). The route's
    // own `load` is also honoured; loadModule lets a test stub the transport.
    // A mount/load failure must NOT propagate out of navigate() and must not
    // leave the host half-torn-down: `current` is already null (defined state).
    try {
      if (def.load) await def.load();
      if (cfg.loadModule && typeof def.meta?.["module"] === "string") {
        await cfg.loadModule(def.meta["module"] as string);
      }

      const handle = await cfg.mount(host(), def, ctx);
      current = handle ?? null;
    } catch (err) {
      // Host stays in a defined state: previous handle already destroyed,
      // `current` is null, no partial handle is retained.
      current = null;
      captureMountError(id, err);
    }
  }

  function onHashChange(): void {
    void navigate();
  }

  return {
    start(): void {
      addEventListener("hashchange", onHashChange);
      void navigate();
    },
    stop(): void {
      removeEventListener("hashchange", onHashChange);
      try {
        current?.destroy?.();
      } catch (err) {
        captureMountError("router-stop", err);
      }
      current = null;
    },
    navigate,
  };
}
