/* page-assembly — assemblePage(host, spec, ctx): a whole page from a PURE spec,
   zero literal markup, zero fetch. The composer mounts (topbar?) → (rail?) →
   surface from what the spec PROVIDES — there is no server-driven rail fetch and
   no app-registry/topbar hardwire (those were upstream couplings). It hands
   back the section hosts a page mounts data components into.

   Per AC-D3/AC-F1: the `session`/`activePageId`/the rail-presence heuristic and
   the topbar/rail+rail-fetch imports are GONE. Region presence is explicit:
   topbar iff spec.topbar, rail iff spec.rail, surface always. */

import { el } from "./kernel/dom.ts";
import type { MountCtx, MountHandle, PageSpec } from "./contract/index.ts";

export interface PageHandle {
  el: HTMLElement;
  surface: MountHandle;
  rail?: MountHandle;
  section(key: string): HTMLElement | null;
  destroy(): void;
}

export function assemblePage(host: Element, spec: PageSpec, ctx: MountCtx): PageHandle {
  const shell = el("div", { class: "amu-shell" });

  // Mounted handles, recorded in MOUNT order so destroy() can run them reversed.
  const mounted: MountHandle[] = [];

  // topbar — OPTIONAL injected mount, mounted into the shell above the body.
  let topbar: MountHandle | undefined;
  if (spec.topbar) {
    topbar = spec.topbar.mount(shell, ctx, spec.topbar.config);
    mounted.push(topbar);
  }

  const body = el("div", { class: "amu-shell-body" });
  shell.appendChild(body);

  // rail — OPTIONAL, mounted from explicit `groups` data (+ optional injected
  // load). No GET /api/rail, no session heuristic.
  let rail: MountHandle | undefined;
  if (spec.rail) {
    rail = spec.rail.mount(body, ctx, {
      groups: spec.rail.groups,
      ...(spec.rail.active !== undefined ? { active: spec.rail.active } : {}),
      ...(spec.rail.load !== undefined ? { load: spec.rail.load } : {}),
    });
    mounted.push(rail);
  }

  // surface — ALWAYS mounts. The surface mount owns its frame AND, when it
  // implements `section(key)` (as mountSurface does), it ALSO owns the per-section
  // hosts it built from `spec.surface.sections`. In that case page-assembly must
  // NOT append its own hosts (that was a double-render) — it defers to the surface
  // handle's section(key). Only when the surface does NOT provide section(key) do
  // we synthesize a host, so section(key) stays available for bare surfaces.
  const surface = spec.surface.mount(body, ctx, spec.surface);
  mounted.push(surface);

  const surfaceSection = (surface as { section?: (key: string) => HTMLElement | null }).section;
  const ownsSections = typeof surfaceSection === "function";

  const sections = new Map<string, HTMLElement>();
  if (!ownsSections) {
    for (const s of spec.surface.sections) {
      const sectionHost = el("div", { class: "amu-shell-section", "data-section": s.key });
      surface.el.appendChild(sectionHost);
      sections.set(s.key, sectionHost);
    }
  }

  host.appendChild(shell);

  return {
    el: shell,
    surface,
    ...(rail ? { rail } : {}),
    // Prefer the surface's own section host (no double-render); fall back to the
    // synthesized host for a bare surface that doesn't implement section(key).
    section: (key) =>
      ownsSections ? (surfaceSection!(key) ?? null) : (sections.get(key) ?? null),
    destroy: () => {
      // Reverse mount order; a failing child destroy must not block the cascade.
      for (let i = mounted.length - 1; i >= 0; i--) {
        const handle = mounted[i];
        try {
          handle?.destroy?.();
        } catch {
          /* a throwing child destroy is swallowed so the cascade completes */
        }
      }
      shell.remove();
    },
  };
}
