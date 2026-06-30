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

  // surface — ALWAYS mounts. The surface mount owns its frame; page-assembly
  // owns the per-section hosts (so section(key) is stable regardless of the
  // surface implementation).
  const surface = spec.surface.mount(body, ctx, spec.surface);
  mounted.push(surface);

  const sections = new Map<string, HTMLElement>();
  for (const s of spec.surface.sections) {
    const sectionHost = el("div", { class: "amu-shell-section", "data-section": s.key });
    surface.el.appendChild(sectionHost);
    sections.set(s.key, sectionHost);
  }

  host.appendChild(shell);

  return {
    el: shell,
    surface,
    ...(rail ? { rail } : {}),
    section: (key) => sections.get(key) ?? null,
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
