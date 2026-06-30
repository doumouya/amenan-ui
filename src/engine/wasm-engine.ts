/* wasm-engine — the lazy loader for the dual-surface data engine. Cold visitors
   pay zero bytes; the first engine call dynamically imports + initialises the
   wasm-bindgen module, then the loaded module's exports are introspected at
   runtime (no hand-maintained method array — whatever the consumer's Rust crate
   exports under #[wasm_bindgen] is callable the day it ships).

   DECOUPLING (AC-I1): the wasm path is INJECTED, not the hardcoded `/wasm/data.js`
   of the source. The consumer calls `configureEngine({ wasmPath, load? })` once;
   `load?` is an optional injected importer (default `(p) => import(p)`) so a
   bundler that can't see a runtime path — or a test — supplies the module itself.

   GRACEFUL (AC-I3): with NO wasm path configured, `getEngine()` resolves to
   `null` and `clientParseScore`/`loadWorkbook` return `null` — no throw, no
   console error. amenan-ui ships ZERO runtime deps and no wasm binary; the
   engine is entirely optional and consumer-provided. */

/** The introspected wasm-bindgen module surface — every non-internal export is
    callable by name. Kept loose (the exact methods are the consumer's crate). */
export type WasmEngine = Record<string, unknown>;

/** A wasm-bindgen-style module: a default init + named exports. */
export interface WasmModule {
  default?: (...args: unknown[]) => Promise<unknown>;
  [name: string]: unknown;
}

/** The dynamic importer — given the configured path, resolve the wasm module.
    Defaults to the platform's dynamic `import()`. */
export type EngineLoader = (wasmPath: string) => Promise<WasmModule>;

export interface EngineConfig {
  /** The wasm-bindgen JS entry path (was the source's hardcoded `/wasm/data.js`). */
  wasmPath?: string;
  /** Optional injected importer (default `(p) => import(p)`) — lets a bundler or a
      test supply the module without a runtime path literal. */
  load?: EngineLoader;
}

let wasmPath: string | null = null;
let loader: EngineLoader | null = null;
let enginePromise: Promise<WasmEngine | null> | null = null;

/** Configure the engine's wasm source. Idempotent re-config resets the lazy
    cache so the next `getEngine()` picks up the new path/loader. */
export function configureEngine(cfg: EngineConfig = {}): void {
  wasmPath = cfg.wasmPath ?? null;
  loader = cfg.load ?? null;
  enginePromise = null; // a new config supersedes any cached load
}

/** Lazily import + initialise the configured wasm module and return its
    introspected callable surface. Resolves to `null` (never throws, never logs)
    when no wasm path is configured — the optional/graceful contract (AC-I3). */
export function getEngine(): Promise<WasmEngine | null> {
  if (!enginePromise) {
    const path = wasmPath;
    if (!path) {
      // No engine configured — degrade cleanly. Cache the null so repeat callers
      // don't re-check; configureEngine() resets this.
      enginePromise = Promise.resolve(null);
      return enginePromise;
    }
    const importer: EngineLoader = loader ?? ((p) => import(/* @vite-ignore */ p) as Promise<WasmModule>);
    enginePromise = (async () => {
      const mod = await importer(path);
      if (typeof mod.default === "function") await mod.default(); // streams + compiles
      const engine: WasmEngine = {};
      for (const [name, value] of Object.entries(mod)) {
        if (typeof value === "function" && name !== "default" && !name.startsWith("__")) {
          engine[name] = value;
        }
      }
      return engine;
    })().catch((e: unknown) => {
      enginePromise = null; // allow retry after a transient failure
      throw e;
    });
  }
  return enginePromise;
}

/** Client-side instant quality report for raw CSV bytes — the same
    parse → summarize → score path the server's upload runs; the bytes never
    leave the device. Returns the parsed JSON report, or `null` when the engine
    is unavailable (no wasm path, or it lacks `parse_score`) so callers degrade
    gracefully (the server report still arrives via the upload response). */
export async function clientParseScore(bytes: ArrayBuffer | Uint8Array): Promise<unknown> {
  try {
    const engine = await getEngine();
    const fn = engine?.["parse_score"];
    if (typeof fn !== "function") return null;
    const out = (fn as (b: Uint8Array, tld?: string) => unknown)(toBytes(bytes), undefined);
    return typeof out === "string" ? JSON.parse(out) : out;
  } catch {
    return null;
  }
}

/** Load raw CSV bytes into a resident client-side Workbook — the in-browser
    data engine. The returned instance holds the parsed frame in wasm memory;
    call its `.page`/`.filter_page`/`.score`/`.rows`/`.cols`. `tld` is the
    optional encoding hint (e.g. "fr"). Returns `null` when the engine is
    unavailable, so callers degrade to the server pages exactly like
    `clientParseScore`. */
export async function loadWorkbook(
  bytes: ArrayBuffer | Uint8Array,
  tld?: string,
): Promise<unknown> {
  try {
    const engine = await getEngine();
    const wb = engine?.["Workbook"] as { from_csv?: (b: Uint8Array, tld?: string) => unknown } | undefined;
    if (typeof wb?.from_csv !== "function") return null;
    return wb.from_csv(toBytes(bytes), tld);
  } catch {
    return null;
  }
}

function toBytes(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}
