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

/** Is this a MountHandle (has an `el`) vs a raw Node? Firmed via `instanceof Node`
    when the global is present (real DOM), falling back to the structural check the
    shim/test harness relies on (`"el" in v` && no `nodeType`). */
function isMountHandle(v: Node | MountHandle): v is MountHandle {
  if (typeof v !== "object" || v === null) return false;
  if (typeof Node !== "undefined" && v instanceof Node) return false;
  return "el" in v && !("nodeType" in v);
}

/** A genuine HTMLElement host can be used directly; a non-element Node (Text /
    DocumentFragment) must be wrapped so `handle.el` is a real HTMLElement and
    destroy()/CSS work. Real DOM: `nodeType === 1`. Test shim: no `nodeType` but a
    tagged, appendable element node that isn't a text node. */
function isElementHost(node: Node): boolean {
  const nt = (node as { nodeType?: number }).nodeType;
  if (typeof nt === "number") return nt === 1; // 1 = ELEMENT_NODE (real DOM)
  const n = node as unknown as { tagName?: unknown; appendChild?: unknown };
  return (
    typeof n.appendChild === "function" &&
    typeof n.tagName === "string" &&
    n.tagName !== "#TEXT"
  );
}

/** Wrap a LEAF factory — `(config?) => Node` (or `(config?) => MountHandle`) —
    into a uniform `Mount`, so the registry/page-assembly/router only ever deal
    in `Mount`s. The produced mount appends the leaf's element to `host`; its
    handle's `destroy()` removes that element (when the factory returned a raw
    Node) or delegates to the factory's own handle.

    When the factory returns a non-HTMLElement Node (Text / DocumentFragment), it
    is WRAPPED in a real `<div>` host so `handle.el` is a genuine HTMLElement —
    `destroy()` removes that host (taking the node with it) and CSS/layout work. */
export function toMount<C>(factory: (config?: C) => Node | MountHandle): Mount<C> {
  return (host: Element, _ctx: MountCtx, config?: C): MountHandle => {
    const produced = factory(config);
    if (isMountHandle(produced)) {
      host.appendChild(produced.el);
      return produced;
    }
    const node = produced;
    if (isElementHost(node)) {
      // The node is itself a real element — use it directly as the handle's el.
      const el = node as unknown as HTMLElement;
      host.appendChild(el);
      return {
        el,
        destroy: () => {
          el.parentNode?.removeChild(el);
        },
      };
    }
    // Non-element Node (Text / DocumentFragment): wrap in a real <div> host so
    // `handle.el` is a genuine HTMLElement.
    const wrapper = document.createElement("div");
    wrapper.appendChild(node);
    host.appendChild(wrapper);
    return {
      el: wrapper,
      destroy: () => {
        wrapper.parentNode?.removeChild(wrapper);
      },
    };
  };
}
