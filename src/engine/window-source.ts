/* window-source — the pluggable WINDOW behind the grid, dual-source behind the
   Service seam (AC-I2).

   One interface, two sources, the SAME QuerySpec:
     { kind, ready, window(spec, offset, limit) → page, sql(query) → page,
       score() → report|null, destroy() }
   where page = { columns, rows, total } and spec = { filter?, search?, sort? } | null.

   · serverSource(cfg)  — pages/sql via the INJECTED `config.window`/`config.sql`
     callbacks (the consumer wires them to its own transport — there is NO server
     file-page path literal and no global fetch wrapper import here; the SOURCE
     FRAMEWORK's hardcoded `post(<file-page path>)` becomes injected callbacks).
     The source of truth and the fallback for frames past the client budget.
   · clientSource(cfg)  — a resident wasm Workbook (via the injected wasm path,
     see wasm-engine.configureEngine). Parse ONCE on open from the injected
     `config.bytes`/`config.fetchBytes`, then answer warm windows + the score
     off the resident frame. The data stays on the device.

   The grid composes a source and calls window()/score() — it never knows which.
   pickSource() routes by a rows×cols budget: client where it fits + a wasm engine
   is configured, server for the genuinely huge tail (or when no engine exists).

   GRACEFUL (AC-I3): with no wasm path configured AND no server callbacks, a
   source's window()/sql()/score() resolve to an EMPTY page / null — no throw, no
   console error. Engine is entirely optional. */

import { loadWorkbook } from "./wasm-engine.ts";

/** A window query — the same spec both surfaces honour. `null` = the full frame. */
export interface QuerySpec {
  filter?: unknown;
  search?: string;
  sort?: unknown;
}

/** A window of data: the visible columns, the row page, and the total row count. */
export interface DataPage {
  columns: { key: string; label?: string }[];
  rows: Record<string, unknown>[];
  total: number;
}

/** A quality report (opaque — the consumer's engine defines its shape). */
export type WindowScoreReport = unknown;

/** The uniform source the grid composes. */
export interface WindowSource {
  kind: "server" | "client";
  ready: Promise<void>;
  window(spec: QuerySpec | null, offset: number, limit: number): Promise<DataPage>;
  sql(query: string): Promise<DataPage>;
  score(): Promise<WindowScoreReport | null>;
  destroy(): void;
}

const EMPTY_PAGE: DataPage = { columns: [], rows: [], total: 0 };

/* ── server source ─────────────────────────────────────────────────────────
   The transport is INJECTED. The consumer supplies `window`/`sql` (e.g. wired
   to its Service: `(spec, off, lim) => service.post("/files/"+rid+"/page", …)`).
   Omitting a callback degrades that op to an empty page (AC-I3). */
export interface ServerSourceCfg {
  /** Fetch a page from the server (the consumer's transport). */
  window?: (spec: QuerySpec | null, offset: number, limit: number) => Promise<DataPage>;
  /** Read-only SQL over the server frame (table `t`). */
  sql?: (query: string) => Promise<DataPage>;
  /** The server's score arrives via the file summary, not per-window, so this is
      `null` by default; supply it only if the consumer pages a score. */
  score?: () => Promise<WindowScoreReport | null>;
}

export function serverSource(cfg: ServerSourceCfg = {}): WindowSource {
  return {
    kind: "server",
    ready: Promise.resolve(),
    window: (spec, offset, limit) =>
      cfg.window ? cfg.window(spec, offset, limit) : Promise.resolve(EMPTY_PAGE),
    sql: (query) => (cfg.sql ? cfg.sql(query) : Promise.resolve(EMPTY_PAGE)),
    score: () => (cfg.score ? cfg.score() : Promise.resolve(null)),
    destroy() {},
  };
}

/* ── client source ─────────────────────────────────────────────────────────
   A resident wasm Workbook loaded from the injected bytes (no Worker, no
   engine-worker.js — the engine is the in-process wasm module via the configured
   path). Parse ONCE on open; window/sql/score read the resident frame. With no
   wasm engine configured, loadWorkbook → null and every op degrades to an empty
   page (AC-I3). */
export interface ClientSourceCfg {
  /** Raw CSV bytes already in hand (the parse source). */
  bytes?: ArrayBuffer | Uint8Array;
  /** Or a lazy byte fetcher (e.g. the consumer's export endpoint) — invoked once
      on open. Preferred over `bytes` so cold opens pay nothing. */
  fetchBytes?: () => Promise<ArrayBuffer | Uint8Array>;
  /** Optional encoding hint (e.g. "fr"). */
  tld?: string;
}

/** A resident Workbook surface — the methods the wasm Workbook exposes. Each
    page/filter/score returns a JSON STRING (parsed here) or an object. */
interface Workbook {
  page?: (offset: number, limit: number) => unknown;
  filter_page?: (filterJson: string, offset: number, limit: number) => unknown;
  sql?: (query: string) => unknown;
  score?: () => unknown;
}

function asPage(out: unknown): DataPage {
  const v = typeof out === "string" ? safeParse(out) : out;
  if (v && typeof v === "object") {
    const o = v as Partial<DataPage>;
    return {
      columns: Array.isArray(o.columns) ? o.columns : [],
      rows: Array.isArray(o.rows) ? o.rows : [],
      total: typeof o.total === "number" ? o.total : 0,
    };
  }
  return EMPTY_PAGE;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function clientSource(cfg: ClientSourceCfg = {}): WindowSource {
  let wb: Workbook | null = null;

  const ready = (async () => {
    try {
      const bytes = cfg.fetchBytes ? await cfg.fetchBytes() : cfg.bytes;
      if (!bytes) return; // nothing to parse — degrade to empty
      wb = (await loadWorkbook(bytes, cfg.tld)) as Workbook | null;
    } catch {
      wb = null; // no engine / parse failure — degrade to empty (no throw)
    }
  })();

  return {
    kind: "client",
    ready,
    async window(spec, offset, limit) {
      await ready;
      if (!wb) return EMPTY_PAGE;
      try {
        if (spec && typeof wb.filter_page === "function") {
          return asPage(wb.filter_page(JSON.stringify(spec), offset, limit));
        }
        if (typeof wb.page === "function") return asPage(wb.page(offset, limit));
        return EMPTY_PAGE;
      } catch {
        return EMPTY_PAGE;
      }
    },
    async sql(query) {
      await ready;
      if (!wb || typeof wb.sql !== "function") return EMPTY_PAGE;
      try {
        return asPage(wb.sql(query));
      } catch {
        return EMPTY_PAGE;
      }
    },
    async score() {
      await ready;
      if (!wb || typeof wb.score !== "function") return null;
      try {
        const out = wb.score();
        return typeof out === "string" ? safeParse(out) : out;
      } catch {
        return null;
      }
    },
    destroy() {
      wb = null;
    },
  };
}

/* pickSource — the rows×cols budget. `cells` = rows × cols; the threshold is a
   first cut. Routes to the CLIENT source when the frame fits the cell budget AND
   client config is supplied; else the SERVER source (or when only server config
   exists). With neither configured, returns a server source that degrades to
   empty pages (AC-I3). */
const CELL_BUDGET = 12_000_000;

export interface PickSourceCfg {
  rows?: number;
  cols?: number;
  /** Client (wasm) source config — used when the frame fits the cell budget. */
  client?: ClientSourceCfg;
  /** Server source config — the fallback for the huge tail / when no client cfg. */
  server?: ServerSourceCfg;
}

export function pickSource(cfg: PickSourceCfg = {}): WindowSource {
  const { rows = 0, cols = 0 } = cfg;
  const fits = !(rows && cols && rows * cols > CELL_BUDGET);
  if (fits && cfg.client) return clientSource(cfg.client);
  return serverSource(cfg.server);
}
