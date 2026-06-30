/* component-registry.ts — the single-source component index. A typed
   Map<string, Component>: every component registers its Mount under a name; the
   showcase enumerates the registry to prove completeness, and consumers obtain
   markup ONLY through these mounts. The warn prefix is `[amu]`; meta is carried
   under Component.meta (per AC-D1/AC-E1). */

import type { Component, Mount } from "../contract/index.ts";

const components = new Map<string, Component>();

export function register<C>(
  name: string,
  mount: Mount<C>,
  meta?: Record<string, unknown>,
): void {
  if (components.has(name)) {
    console.warn(`[amu] component ${name} registered twice — one owner only`);
  }
  const entry: Component = { name, mount: mount as Mount };
  if (meta !== undefined) entry.meta = meta;
  components.set(name, entry);
}

export function getComponent(name: string): Component | null {
  return components.get(name) ?? null;
}

export function listComponents(): Component[] {
  return [...components.values()];
}
