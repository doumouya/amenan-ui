/* empty-state — title + one line + ONE action. The empty state IS the
   onboarding; if it needs more words, the design is wrong.
   mountEmptyState(host, {title, line, action?: {label, variant?, onClick}}). */

import { el } from "../../kernel/dom.ts";
import { button } from "../atoms/atoms.ts";
import type { ButtonVariant } from "../atoms/atoms.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface EmptyStateAction {
  label: string;
  variant?: ButtonVariant;
  onClick?: EventListener;
}

export interface EmptyStateCfg {
  title: string;
  line?: string;
  action?: EmptyStateAction;
}

export function mountEmptyState(host: Element, cfg: EmptyStateCfg): MountHandle {
  const node = el(
    "div",
    { class: "amu-empty" },
    el("h3", { class: "amu-empty-title" }, cfg.title),
    cfg.line ? el("p", { class: "amu-empty-line" }, cfg.line) : null,
    cfg.action ? button({ variant: "accent", ...cfg.action }) : null,
  );
  host.append(node);
  return { el: node, update() {}, destroy: () => node.remove() };
}
