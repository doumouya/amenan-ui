/* surface — the content frame. mountSurface(host, {title, meta?, actions?,
   sections: [{key, title?, layout?}], head?}) → handle.section(key) returns the
   host element a page mounts data components into. Composes atoms.button for the
   head-band actions. Sole owner of .amu-surface*. */

import { el } from "../../kernel/dom.ts";
import { button } from "../atoms/atoms.ts";
import type { ButtonCfg } from "../atoms/atoms.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface SurfaceSection {
  key: string;
  title?: string;
  /** `grid` · `row` · `fill` — the section spec picks layout, never CSS. */
  layout?: string;
}

export interface SurfaceCfg {
  title?: string;
  meta?: string;
  actions?: ButtonCfg[];
  sections?: SurfaceSection[];
  /** head:false → full-bleed (no title/meta/actions band). */
  head?: boolean;
}

export interface SurfaceUpdate {
  title?: string;
  meta?: string;
}

export interface SurfaceHandle extends MountHandle<SurfaceUpdate> {
  /** The host element a page mounts a section's content into (null if unknown). */
  section: (key: string) => HTMLElement | null;
}

export function mountSurface(host: Element, cfg: SurfaceCfg): SurfaceHandle {
  const surface = el("main", { class: "amu-surface" });
  // The head band (title · meta · actions) is omitted when head:false — a
  // full-bleed page gives the whole surface to its content. update({title,meta})
  // then no-ops safely (guarded below).
  if (cfg.head !== false) {
    const head = el(
      "div",
      { class: "amu-surface-head" },
      el("h1", { class: "amu-surface-title" }, cfg.title ?? ""),
      // The meta span is ALWAYS present so update({meta}) can populate it later
      // (a page often learns its row count after the head is mounted).
      el("span", { class: "amu-surface-meta" }, cfg.meta ?? ""),
    );
    const actions = el("div", { class: "amu-surface-actions" });
    for (const a of cfg.actions ?? []) actions.append(button(a));
    head.append(actions);
    surface.append(head);
  }

  const sections = new Map<string, HTMLElement>();
  for (const s of cfg.sections ?? []) {
    const body = el("div", {
      class: `amu-surface-section-body${s.layout ? ` amu-surface-section-body--${s.layout}` : ""}`,
    });
    surface.append(
      el(
        "section",
        { class: "amu-surface-section" },
        s.title ? el("h2", { class: "amu-surface-section-title" }, s.title) : null,
        body,
      ),
    );
    sections.set(s.key, body);
  }

  host.append(surface);
  return {
    el: surface,
    section: (key: string) => sections.get(key) ?? null,
    update: (p: SurfaceUpdate) => {
      if ("title" in p) {
        const t = surface.querySelector(".amu-surface-title");
        if (t) t.textContent = p.title ?? ""; // no-op on a head:false surface
      }
      if ("meta" in p) {
        const m = surface.querySelector(".amu-surface-meta");
        if (m) m.textContent = p.meta ?? "";
      }
    },
    destroy: () => surface.remove(),
  };
}
