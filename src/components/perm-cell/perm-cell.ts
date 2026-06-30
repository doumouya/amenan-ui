/* perm-cell — the cycling permission cell for admin RBAC matrices. One click
   cycles the tier's access through a CONFIG-driven order (default ["", "r", "rw"]).
   PURE: this is just the cell — it holds NO matrix data, fetches nothing, and
   knows nothing about a Service. The CONSUMER owns the matrix and persistence:
   the cell paints OPTIMISTICALLY and reports the next value via onChange(next);
   when the consumer's write fails it reverts the paint via update({ value }).

   DECOUPLING (AC-H3): no data layer, no I/O, no hardcoded route — the only seam
   is the onChange callback + the optional config-driven cycle order.

   mountPermCell(host, { value?, order?, labels?, titles?, onChange? })
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
      ["", "r", "rw"]. */
  order?: readonly string[];
  /** Per-value cell text (falls back to the value, "—" for the empty tier). */
  labels?: Record<string, string>;
  /** Per-value tooltip / aria-label (falls back to the value). */
  titles?: Record<string, string>;
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

  const norm = (v: string | undefined): string =>
    v != null && order.includes(v) ? v : (order[0] ?? "");
  let value = norm(cfg.value);

  const btn = el("button", { class: "amu-perm-cell", type: "button" });

  function paint(): void {
    btn.textContent = labelFor(value);
    btn.dataset.perm = value || "none";
    const t = titleFor(value);
    btn.title = t;
    btn.setAttribute("aria-label", t);
  }

  btn.addEventListener("click", () => {
    const idx = order.indexOf(value);
    value = order[(idx + 1) % order.length] ?? (order[0] ?? "");
    paint(); // optimistic
    cfg.onChange?.(value);
  });

  paint();
  host.append(btn);
  return {
    el: btn,
    update: (p: PermCellUpdate) => {
      if ("value" in p) value = norm(p.value);
      paint();
    },
    destroy: () => btn.remove(),
  };
}
