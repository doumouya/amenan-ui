/* type-registry.ts — THE OBJECT REGISTRY (types are data, like components and
   behavior). Rewritten against the Service SEAM (no hardwired transport): getTypes(source)
   fetches the type catalogue ONCE and caches the promise — consumers derive chip
   labels, table columns and per-tier field cells from it instead of hardcoding
   object shapes. invalidate() clears the cache (an admin write re-derives from
   the source next read, never patches locally).

   `source` is either a full Service (we call service.get<…>("/types")) or a bare
   Source<TypeDef[]> (the consumer's own loader) — so the registry stays decoupled
   from any concrete transport. */

import type { Service, Source } from "../contract/index.ts";

export interface TypeField {
  key: string;
  label: string;
  data_type: string;
  perm_class: string;
  options?: unknown;
  cells?: Record<string, string>;
}

export interface TypeDef {
  type_id: string;
  display_name: string;
  is_builtin: boolean;
  fields: TypeField[];
}

type TypeSource = Service | Source<TypeDef[]>;

let cache: Promise<TypeDef[]> | null = null; // one in-flight load, shared

function isService(s: TypeSource): s is Service {
  return typeof s === "object" && s !== null && typeof (s as Service).get === "function";
}

/** Fetch + cache the type catalogue from the injected source. A failed load
    does NOT poison future reads (the cache self-clears on rejection). */
export function getTypes(source: TypeSource): Promise<TypeDef[]> {
  if (!cache) {
    const load: Promise<TypeDef[]> = isService(source)
      ? source
          .get<{ types?: TypeDef[] }>("/types")
          .then((d) => d?.types ?? [])
      : source().then((d) => d ?? []);
    cache = load.catch((err: unknown) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

export function invalidate(): void {
  cache = null;
}

export async function getType(source: TypeSource, id: string): Promise<TypeDef | null> {
  return (await getTypes(source)).find((t) => t.type_id === id) ?? null;
}
