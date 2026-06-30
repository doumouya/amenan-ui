/* toast — transient feedback; the partner of optimistic UI (every optimistic
   mutation pairs with a toast carrying revert when it fails).
   toast({message, tone?, action?: {label, onClick}, ttl?}). */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export type ToastTone = "danger";

export interface ToastAction {
  label: string;
  onClick?: () => void;
}

export interface ToastCfg {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
  ttl?: number;
}

let stack: HTMLDivElement | null = null;

function ensureStack(): HTMLDivElement {
  if (!stack || !stack.isConnected) {
    stack = el("div", { class: "amu-toast-stack", role: "status", "aria-live": "polite" });
    document.body.append(stack);
  }
  return stack;
}

export function toast(cfg: ToastCfg): MountHandle {
  const action = cfg.action;
  const node = el(
    "div",
    { class: `amu-toast${cfg.tone ? ` amu-toast--${cfg.tone}` : ""}` },
    el("span", {}, cfg.message),
    action
      ? el(
          "button",
          {
            class: "amu-toast-action",
            type: "button",
            onclick: () => {
              action.onClick?.();
              node.remove();
            },
          },
          action.label,
        )
      : null,
  );
  ensureStack().append(node);
  const ttl = cfg.ttl ?? (action ? 6000 : 3000);
  setTimeout(() => node.remove(), ttl);
  return { el: node, destroy: () => node.remove() };
}
