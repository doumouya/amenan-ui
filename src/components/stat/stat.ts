/* stat — KPI tile. mountStat(host, {label, value, tone?, sub?});
   mountStatStrip(host, {stats: [...]}) lays a responsive row of them. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export type StatTone = "ok" | "warn" | "danger";

export interface StatCfg {
  label: string;
  value: string | number;
  tone?: StatTone;
  sub?: string;
}

export interface StatUpdate {
  value?: string | number;
  tone?: StatTone;
}

export function mountStat(host: Element, cfg: StatCfg): MountHandle<StatUpdate> {
  const value = el(
    "div",
    { class: `amu-stat-value${cfg.tone ? ` is-${cfg.tone}` : ""}` },
    String(cfg.value),
  );
  const node = el(
    "div",
    { class: "amu-stat" },
    el("div", { class: "amu-stat-label" }, cfg.label),
    value,
    cfg.sub ? el("div", { class: "amu-stat-sub" }, cfg.sub) : null,
  );
  host.append(node);
  return {
    el: node,
    update: (p: StatUpdate) => {
      if ("value" in p) value.textContent = String(p.value);
      if ("tone" in p) value.className = `amu-stat-value${p.tone ? ` is-${p.tone}` : ""}`;
    },
    destroy: () => node.remove(),
  };
}

export interface StatStripCfg {
  stats?: StatCfg[];
}

export interface StatStripHandle extends MountHandle {
  handles: MountHandle<StatUpdate>[];
}

export function mountStatStrip(host: Element, cfg: StatStripCfg): StatStripHandle {
  const strip = el("div", { class: "amu-stat-strip" });
  const handles = (cfg.stats ?? []).map((s) => mountStat(strip, s));
  host.append(strip);
  return { el: strip, handles, update() {}, destroy: () => strip.remove() };
}
