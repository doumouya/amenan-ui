/* route.ts — the generic route map + guard chain. No app registry, no auth/
   admin/login knowledge: the source framework's three hardcoded gates become
   consumer Guards, and the page-convention fetch becomes the consumer's
   mount/loadModule. */

import type { Mount } from "./mount.ts";

export interface RouteDef {
  mount?: Mount;
  load?: () => Promise<unknown>;
  meta?: Record<string, unknown>;
}

export type RouteMap = Record<string, RouteDef>;

export interface RouteCtx {
  session?: unknown;
  params?: Record<string, string>;
}

/** A guard returns a redirect route id, or null to allow navigation. The first
    guard returning a non-null id wins (redirects + aborts). */
export type Guard = (id: string, ctx: RouteCtx) => string | null;

export interface Router {
  start(): void;
  stop(): void;
  navigate(): void | Promise<void>;
}
