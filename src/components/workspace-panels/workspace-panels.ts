/* workspace-panels — the RESPONSIVE 3-region frame: a left region, a center, and a
   right region. It owns the responsive @media + the side-drawer behavior (an
   off-canvas drawer + scrim — matchMedia event-driven, classList only, no width
   polling).

   It returns the three region HOST elements; the consumer mounts content into
   left + right and center. The frame knows nothing about their content.

   mountWorkspacePanels(host) → {
     el, left, center, right,        // the three region elements
     togglePanel("left"|"right"),    // flip a side drawer
     setPanelOpen(side, bool), isOpen(side),
     destroy,
   }

   Layout: ≥ --bp-lg (80rem) the three regions are a CSS grid; below, the center is
   the single column and left/right become FIXED off-canvas drawers over a shared
   scrim. Opening one closes the other; a scrim click closes. Sole owner of every
   .amu-wsp* class (ui-fork-audit R4). knobs: --wsp-left-w --wsp-right-w */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export type PanelSide = "left" | "right";

export interface WorkspacePanelsHandle extends MountHandle {
  left: HTMLElement;
  center: HTMLElement;
  right: HTMLElement;
  togglePanel(side: PanelSide): void;
  setPanelOpen(side: PanelSide, want: boolean): void;
  isOpen(side: PanelSide): boolean;
}

export function mountWorkspacePanels(host: Element): WorkspacePanelsHandle {
  const root = el("div", { class: "amu-wsp" });
  const left = el("div", { class: "amu-wsp-region amu-wsp-left" });
  const center = el("div", { class: "amu-wsp-region amu-wsp-center" });
  const right = el("div", { class: "amu-wsp-region amu-wsp-right" });
  const scrim = el("div", { class: "amu-wsp-scrim" });
  root.append(left, center, right, scrim);

  // ── narrow-viewport drawer (below --bp-lg, 80rem): the side regions become
  //    off-canvas drawers. matchMedia is event-driven; classList only — no inline
  //    styles. ─────────────────────────────────────────────────────────────────
  const narrow = window.matchMedia("(max-width: 80rem)"); // --bp-lg

  function regionFor(side: PanelSide): HTMLElement {
    return side === "left" ? left : right;
  }
  function isOpen(side: PanelSide): boolean {
    return regionFor(side).classList.contains("is-open");
  }
  function setPanelOpen(side: PanelSide, want: boolean): void {
    const region = regionFor(side);
    const open = !!want;
    // single overlay: opening one closes the other.
    if (open) {
      const other = side === "left" ? right : left;
      other.classList.remove("is-open");
    }
    region.classList.toggle("is-open", open);
    // the scrim shows whenever EITHER drawer is open.
    scrim.classList.toggle(
      "is-open",
      left.classList.contains("is-open") || right.classList.contains("is-open"),
    );
  }
  function togglePanel(side: PanelSide): void {
    setPanelOpen(side, !isOpen(side));
  }

  scrim.addEventListener("click", () => {
    left.classList.remove("is-open");
    right.classList.remove("is-open");
    scrim.classList.remove("is-open");
  });

  // Crossing back to wide drops any drawer state (the regions are inline grid
  // columns again, no overlay).
  const onWideChange = (e: MediaQueryListEvent): void => {
    if (!e.matches) {
      left.classList.remove("is-open");
      right.classList.remove("is-open");
      scrim.classList.remove("is-open");
    }
  };
  narrow.addEventListener("change", onWideChange);

  host.append(root);
  return {
    el: root,
    left,
    center,
    right,
    togglePanel,
    setPanelOpen,
    isOpen,
    destroy: () => {
      narrow.removeEventListener("change", onWideChange);
      root.remove();
    },
  };
}
