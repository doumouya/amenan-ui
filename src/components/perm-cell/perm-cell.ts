/* perm-cell — the cycling permission cell for admin RBAC matrices. One click
   cycles the tier's access through a CONFIG-driven order (default ["", "r", "rw"]).
   PURE: this is just the cell — it holds NO matrix data, fetches nothing, and
   knows nothing about a Service. The CONSUMER owns the matrix and persistence:
   the cell paints OPTIMISTICALLY and reports the next value via onChange(next);
   when the consumer's write fails it reverts the paint via update({ value }).

   DECOUPLING (AC-H3): no data layer, no I/O, no hardcoded route — the only seam
   is the onChange callback + the optional config-driven cycle order.

   CAP CEILING (AC-18): an optional `cap` clamps the highest reachable tier — e.g.
   `cap:"r"` is a field even an Admin may only read (cycling ceils at `r` and wraps
   back to the floor, never reaching `rw`). `cap` = the empty/floor tier (`""`) is a
   permanently-locked guardrail: it stamps `data-locked="1"`, a click is a no-op
   (onChange never fires), and CSS renders a lock glyph + not-allowed cursor.

   mountPermCell(host, { value?, order?, labels?, titles?, cap?, onChange? })
     → { el, update({ value }), destroy }

   Sole owner of every .amu-perm* class (ui-fork-audit R4); state rides
   data-perm: none | <value> (e.g. "r" | "rw"). */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

/** The default access ladder: none → read → read+write → (wraps to none). */
export const DEFAULT_PERM_ORDER: readonly string[] = ["", "r", "rw"];

const DEFAULT_LABELS: Record<string, string> = { "": "—", r: "r", rw: "rw" };
const DEFAULT_TITLES: Record<string, string> = {
  "": "no access — click for read",
  r: "read-only — click for read + write",
  rw: "read + write — click for no access",
};

export interface PermCellCfg {
  /** The current tier value; must be one of `order` (else falls to the first). */
  value?: string;
  /** The cycle order (one click advances to the next; wraps). Default
      ["", "r", "rw"]. Should hold ≥2 tiers; a 1-element `order` makes the cell a
      permanent lock (capIdx 0 ⇒ data-locked, click is a no-op). */
  order?: readonly string[];
  /** Per-value cell text (falls back to the value, "—" for the empty tier). */
  labels?: Record<string, string>;
  /** Per-value tooltip / aria-label (falls back to the value). */
  titles?: Record<string, string>;
  /** The cap CEILING — the highest tier reachable by cycling (clamped to `order`).
      Cycling ceils here and wraps back to the floor; tiers above `cap` are never
      surfaced. `cap` = the floor tier (`order[0]`, e.g. "") is a permanently-locked
      guardrail (data-locked="1", click is a no-op). Omitted ⇒ the full `order`. */
  cap?: string;
  /** Called with the NEXT value after a click — the consumer persists it and, on
      failure, reverts via the handle's update({ value }). */
  onChange?: (next: string) => void;
}

/** The narrow update the consumer uses to revert a failed optimistic write. */
export interface PermCellUpdate {
  value?: string;
}

export function mountPermCell(host: Element, cfg: PermCellCfg = {}): MountHandle<PermCellUpdate> {
  const order = cfg.order && cfg.order.length ? cfg.order : DEFAULT_PERM_ORDER;
  const labelFor = (v: string): string =>
    cfg.labels?.[v] ?? DEFAULT_LABELS[v] ?? (v || "—");
  const titleFor = (v: string): string => cfg.titles?.[v] ?? DEFAULT_TITLES[v] ?? v;

  // The cap ceiling index (AC-18). Omitted ⇒ the full order (cap = the last tier).
  // A cap clamped to the floor (index 0) is a permanently-locked guardrail.
  const capIdx =
    cfg.cap != null && order.includes(cfg.cap) ? order.indexOf(cfg.cap) : order.length - 1;
  const locked = capIdx <= 0;

  // norm clamps both the initial value and any reverted value to [floor, cap].
  const norm = (v: string | undefined): string => {
    const i = v != null ? order.indexOf(v) : -1;
    const clamped = Math.min(Math.max(i, 0), capIdx);
    return order[clamped] ?? (order[0] ?? "");
  };
  let value = norm(cfg.value);

  const btn = el("button", { class: "amu-perm-cell", type: "button" });

  function paint(): void {
    btn.textContent = labelFor(value);
    btn.dataset.perm = value || "none";
    if (locked) btn.dataset.locked = "1";
    const t = locked ? "locked — no access to this field for this role" : titleFor(value);
    btn.title = t;
    btn.setAttribute("aria-label", t);
  }

  btn.addEventListener("click", () => {
    if (locked) return; // a guardrail cell never grants — click is a no-op
    // Cycle within [floor, cap]: span = capIdx + 1 tiers, wrap back to the floor.
    const span = capIdx + 1;
    const idx = order.indexOf(value);
    value = order[(idx + 1) % span] ?? (order[0] ?? "");
    paint(); // optimistic
    cfg.onChange?.(value);
  });

  paint();
  host.appendChild(btn);
  return {
    el: btn,
    update: (p: PermCellUpdate) => {
      if ("value" in p) value = norm(p.value);
      paint();
    },
    destroy: () => btn.remove(),
  };
}
