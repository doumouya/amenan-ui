/* card — content tile. mountCard(host, {title, sub?, href?, onClick?, body?}). */

import { el } from "../../kernel/dom.ts";
import type { Child } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface CardCfg {
  title?: string;
  sub?: string;
  href?: string;
  onClick?: EventListener;
  body?: Child;
}

export function mountCard(host: Element, cfg: CardCfg): MountHandle {
  const tag = cfg.href ? "a" : cfg.onClick ? "button" : "div";
  const card = el(
    tag,
    {
      class: "amu-card",
      href: cfg.href ?? null,
      type: tag === "button" ? "button" : null,
      onclick: cfg.onClick,
    },
    cfg.title ? el("h3", { class: "amu-card-title" }, cfg.title) : null,
    cfg.sub ? el("p", { class: "amu-card-sub" }, cfg.sub) : null,
    cfg.body ?? null,
  );
  host.append(card);
  return { el: card, update() {}, destroy: () => card.remove() };
}
