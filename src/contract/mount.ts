/* mount.ts — the Mount contract: the single shape every component exposes so
   the registry, page-assembly, and router only ever see `Mount`s and destroy()
   always cascades. The `toMount` adapter reconciles the two authoring tiers
   (a leaf factory returning a raw Node vs a full service-coupled Mount). */

import type { Service } from "./service.ts";

export type { Attrs, Child } from "../kernel/dom.ts";

export interface MountCtx {
  service?: Service; // data seam; leaf components ignore it
  session?: unknown; // opaque to amenan-ui; guards/consumers type it
  signal?: AbortSignal; // teardown propagation
}

export interface MountHandle<U = unknown> {
  el: HTMLElement;
  // Method syntax (not an arrow property) so `update`/`destroy` are checked
  // bivariantly: a concrete `update(partial: {path})` satisfies a `MountHandle`
  // typed with the default `U = unknown` (what the AC-J7 contract test asserts).
  // Semantics are identical to AC-D1's `update?: (partial: U) => void`.
  update?(partial: U): void;
  destroy?(): void;
}

export type Mount<Config = unknown, U = unknown> = (
  host: Element,
  ctx: MountCtx,
  config?: Config,
) => MountHandle<U>;

export interface Component<Config = unknown> {
  name: string;
  mount: Mount<Config>;
  meta?: Record<string, unknown>;
}

/** Is this a MountHandle (has an `el`) vs a raw Node? */
function isMountHandle(v: Node | MountHandle): v is MountHandle {
  return typeof v === "object" && v !== null && "el" in v && !("nodeType" in v);
}

/** Wrap a LEAF factory — `(config?) => Node` (or `(config?) => MountHandle`) —
    into a uniform `Mount`, so the registry/page-assembly/router only ever deal
    in `Mount`s. The produced mount appends the leaf's element to `host`; its
    handle's `destroy()` removes that element (when the factory returned a raw
    Node) or delegates to the factory's own handle. */
export function toMount<C>(factory: (config?: C) => Node | MountHandle): Mount<C> {
  return (host: Element, _ctx: MountCtx, config?: C): MountHandle => {
    const produced = factory(config);
    if (isMountHandle(produced)) {
      host.appendChild(produced.el);
      return produced;
    }
    const node = produced;
    host.appendChild(node);
    const handle: MountHandle = {
      el: node as unknown as HTMLElement,
      destroy: () => {
        (node as ChildNode).parentNode?.removeChild(node as ChildNode);
      },
    };
    return handle;
  };
}
