/* pref-registry.ts — THE BEHAVIOR REGISTRY ("the third framework"). UI is data
   (component-registry), objects are data (type-registry); this makes BEHAVIOR
   data: every user-customizable pref + admin policy is a REGISTRATION. Settings
   and an admin console render themselves from these registrations — they never
   know what knobs exist.

   Rewritten against the Service SEAM: persistence is an INJECTED callback
   (`configurePersistence`) instead of a hardcoded settings PUT. The localStorage
   prefix is `amu-pref-`. The `theme` pref routes through theme.ts so there is
   one owner of `html[data-theme]`. */

import { applyTheme } from "../theme/theme.ts";
import type { ThemeName } from "../theme/theme.ts";

/** control kinds the rendered settings/policy surfaces understand. */
export type PrefControl = "select" | "toggle" | "text" | "multi";

export interface PrefDef {
  key: string;
  label?: string;
  group?: string;
  control?: PrefControl;
  options?: unknown;
  default?: unknown;
  scope?: string;
}

/** The injected persistence sink (was the hardcoded `PUT /settings/...`). A
    consumer wires its Service here; absent, set/setPolicy persist locally only. */
export type Persist = (
  scope: string,
  id: string,
  key: string,
  value: unknown,
) => Promise<unknown>;

const prefs = new Map<string, PrefDef>();
const policies = new Map<string, PrefDef>();
let resolved: Record<string, unknown> = {}; // server-resolved cascade, seeded at boot
let ctx: { userRid: string | null } = { userRid: null };
const listeners = new Set<(key?: string) => void>();
let persist: Persist | null = null;

const LS_PREFIX = "amu-pref-";

function lsRead(key: string): unknown {
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v === null ? undefined : (JSON.parse(v) as unknown);
  } catch {
    return undefined;
  }
}

function lsWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode — a server copy is the truth anyway */
  }
}

function notify(key?: string): void {
  for (const fn of listeners) fn(key);
}

/** Inject the persistence sink (a consumer's Service-backed writer). */
export function configurePersistence(fn: Persist | null): void {
  persist = fn;
}

export function registerPref(def: PrefDef): void {
  prefs.set(def.key, { scope: "user", ...def });
  notify(def.key);
}

export function registerPolicy(def: PrefDef): void {
  policies.set(def.key, { scope: "platform", ...def });
  notify(def.key);
}

/** Boot seed: localStorage mirror first (instant), then the server-resolved
    cascade over it (truth). */
export function seedResolved(
  map?: Record<string, unknown>,
  context?: { userRid?: string | null },
): void {
  if (context) ctx = { ...ctx, ...context };
  resolved = { ...resolved, ...(map ?? {}) };
  // Refresh the mirror for the FOUC keys so the next boot paints right.
  for (const k of ["theme", "density", "fontsize"]) {
    if (k in resolved) lsWrite(k, resolved[k]);
  }
  notify();
}

/** The cascade: server-resolved value → localStorage mirror → registered
    default → undefined. */
export function getPref(key: string): unknown {
  if (key in resolved) return resolved[key];
  const mirrored = lsRead(key);
  if (mirrored !== undefined) return mirrored;
  const def = prefs.get(key) ?? policies.get(key);
  return def ? def.default : undefined;
}

/** Optimistic set: paint now (resolved + mirror + DOM attrs), persist to the
    user scope fire-and-forget via the injected sink. */
export function setPref(key: string, value: unknown): void {
  resolved[key] = value;
  lsWrite(key, value);
  applyDocumentPref(key, value);
  notify(key);
  if (persist && ctx.userRid) {
    void persist("user", ctx.userRid, key, value).catch(() => {});
  }
}

/** Admin surfaces write other scopes explicitly through the injected sink. */
export function setPolicy(
  scopeType: string,
  scopeId: string,
  key: string,
  value: unknown,
): Promise<unknown> {
  if (!persist) return Promise.resolve(undefined);
  return persist(scopeType, scopeId || "_", key, value);
}

/** The document-level prefs reflect onto <html>. `theme` routes through
    theme.ts (one owner of `html[data-theme]`). */
export function applyDocumentPref(key: string, value: unknown): void {
  const root = document.documentElement;
  if (key === "theme") {
    if (value === "dark" || value === "light") applyTheme(value as ThemeName);
    return;
  }
  if (key === "density") {
    if (value === "default") delete root.dataset.density;
    else root.dataset.density = String(value);
  }
  if (key === "fontsize") {
    if (value === "default") delete root.dataset.fontsize;
    else root.dataset.fontsize = String(value);
  }
}

/** Registry listings — what a settings surface (prefs) and an admin console
    (policies) render themselves from. Registration order preserved. */
export function listPrefs(): PrefDef[] {
  return [...prefs.values()];
}
export function listPolicies(): PrefDef[] {
  return [...policies.values()];
}

export function onPrefChange(fn: (key?: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
