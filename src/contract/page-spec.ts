/* page-spec.ts — the pure, declarative page spec page-assembly composes from.
   The rail is DATA (literal `groups`) + an OPTIONAL injected loader — never a
   hardwired fetch. The topbar is an OPTIONAL injected mount — no app-registry
   hardwire. The surface is always present. */

import type { Mount } from "./mount.ts";
import type { Source } from "./service.ts";

export interface SectionSpec {
  key: string;
  title?: string;
  layout?: string;
}

export interface RailGroup {
  title?: string;
  items: { id: string; label: string; href?: string; kind?: string }[];
}

export interface RailSpec {
  mount: Mount<{ groups: RailGroup[]; active?: string; load?: Source<RailGroup[]> }>;
  groups: RailGroup[];
  active?: string;
  load?: Source<RailGroup[]>; // OPTIONAL injected async — replaces GET /api/rail/<view>
}

export interface ActionSpec {
  id: string;
  label: string;
  onClick?: (ev: MouseEvent) => void;
}

export interface SurfaceSpec {
  mount: Mount<SurfaceSpec>;
  title?: string;
  meta?: string;
  actions?: ActionSpec[];
  sections: SectionSpec[];
  head?: boolean; // head:false → full-bleed (no title/meta band)
}

export interface PageSpec {
  topbar?: { mount: Mount; config?: unknown }; // OPTIONAL injected mount — no app-registry hardwire
  rail?: RailSpec; // OPTIONAL — explicit data, not a session heuristic
  surface: SurfaceSpec; // always present
}
