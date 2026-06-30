/* events.ts — frontend error capture: what a backend structurally cannot see
   (uncaught exceptions, unhandled rejections, page-mount failures).
   RULE: this module NEVER imports a Service (recursion guard) — when a consumer
   wants to ship these, it reads pendingEvents() and POSTs them with its own
   transport. Buffered + deduped; capped. The console-warn prefix is `[amu:…]`. */

export interface CapturedEvent {
  kind: string;
  message: string;
  detail?: string;
  at: string;
}

const buffer: CapturedEvent[] = [];
const CAP = 100;
const DEDUP_WINDOW = 10_000; // ms
const seen = new Map<string, number>(); // kind|message → last ts (10s dedup window)

function capture(kind: string, message: string, detail?: string): void {
  const key = `${kind}|${message}`;
  const now = Date.now();
  // Prune entries older than the dedup window so `seen` can't grow unbounded
  // (a long-lived page emitting many distinct errors would leak otherwise).
  for (const [k, ts] of seen) {
    if (now - ts >= DEDUP_WINDOW) seen.delete(k);
  }
  const last = seen.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW) return;
  seen.set(key, now);
  if (buffer.length >= CAP) return;
  buffer.push({ kind, message, detail, at: new Date().toISOString() });
  console.warn(`[amu:${kind}]`, message, detail ?? "");
}

export function installErrorCapture(): void {
  window.addEventListener("error", (e: ErrorEvent) =>
    capture("uncaught", e.message, `${e.filename}:${e.lineno}`),
  );
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = e.reason as { message?: unknown } | undefined;
    capture("rejection", String(reason?.message ?? e.reason));
  });
}

export function captureMountError(page: string, err: unknown): void {
  const message = (err as { message?: unknown } | undefined)?.message;
  capture("mount", `page ${page} failed`, String(message ?? err));
}

export function pendingEvents(): CapturedEvent[] {
  return buffer.slice();
}
