/* score-badge — the cleanness score (a product's headline number) with a
   click-open breakdown of the sub-components.
   mountScoreBadge(host, {score, report?: {completeness, type_consistency,
   value_hygiene, row_uniqueness, structural}}). Sole owner of .amu-score*. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

type Tone = "ok" | "warn" | "danger";

function toneFor(score: number): Tone {
  if (score >= 90) return "ok";
  if (score >= 70) return "warn";
  return "danger";
}

/** A score breakdown — known sub-components, but extra keys render too. */
export interface ScoreReport {
  completeness?: number;
  type_consistency?: number;
  value_hygiene?: number;
  row_uniqueness?: number;
  /** A multiplier gate (rendered as ×N.NN), not a 0–100 score. */
  structural?: number;
  [key: string]: number | undefined;
}

export interface ScoreBadgeCfg {
  score?: number;
  report?: ScoreReport;
}

export type ScoreBadgeUpdate = Partial<ScoreBadgeCfg>;

const REPORT_LABELS: Record<string, string> = {
  completeness: "Completeness",
  type_consistency: "Type consistency",
  value_hygiene: "Value hygiene",
  row_uniqueness: "Row uniqueness",
  structural: "Structure gate",
};

export function mountScoreBadge(host: Element, cfg: ScoreBadgeCfg): MountHandle<ScoreBadgeUpdate> {
  const wrap = el("span", { class: "amu-score" });
  const pill = el("button", { class: "amu-score-pill", type: "button" });
  const pop = el("div", { class: "amu-score-pop" });

  function render({ score, report }: ScoreBadgeCfg): void {
    pill.className = `amu-score-pill is-${toneFor(score ?? 0)}`;
    pill.replaceChildren(
      el("span", {}, score == null ? "—" : String(Math.round(score))),
      el("span", { class: "amu-score-unit" }, "/100"),
    );
    pop.replaceChildren(
      ...Object.entries(report ?? {}).map(([k, v]) =>
        el(
          "div",
          { class: "amu-score-row" },
          el("span", {}, REPORT_LABELS[k] ?? k),
          el("b", {}, k === "structural" ? `×${Number(v).toFixed(2)}` : String(Math.round(Number(v)))),
        ),
      ),
    );
    pill.disabled = !report;
  }
  render(cfg);
  pill.addEventListener("click", () => wrap.classList.toggle("is-open"));
  wrap.append(pill, pop);
  host.append(wrap);
  return {
    el: wrap,
    update: (p: ScoreBadgeUpdate) => render({ ...cfg, ...p }),
    destroy: () => wrap.remove(),
  };
}
