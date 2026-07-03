/* toast — transient feedback; the partner of optimistic UI (every optimistic
   mutation pairs with a toast carrying revert when it fails).
   toast({message, tone?, title?, mono?, action?: {label, onClick}, ttl?}). */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export type ToastTone = "danger" | "ok" | "warn" | "info";

export interface ToastAction {
  label: string;
  onClick?: () => void;
}

export interface ToastCfg {
  message: string;
  tone?: ToastTone;
  /** A bold first line above the message (e.g. the acting subsystem). */
  title?: string;
  /** Render the message in the mono data voice (ids, counts, commands). */
  mono?: boolean;
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
  const body = cfg.title
    ? el(
        "span",
        { class: "amu-toast-body" },
        el("span", { class: "amu-toast-title" }, cfg.title),
        el("span", { class: cfg.mono ? "amu-toast-mono" : null }, cfg.message),
      )
    : el("span", { class: cfg.mono ? "amu-toast-mono" : null }, cfg.message);
  const node = el(
    "div",
    { class: `amu-toast${cfg.tone ? ` amu-toast--${cfg.tone}` : ""}` },
    body,
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
