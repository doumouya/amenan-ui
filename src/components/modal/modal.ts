/* modal — create + confirm-destructive only; everything else is inline (the
   minimalism rule). openModal({title, body, actions}) returns {el, close}.
   confirmModal({title, message, confirmLabel, danger}) → Promise<boolean>. */

import { el } from "../../kernel/dom.ts";
import { button } from "../atoms/atoms.ts";
import type { ButtonVariant } from "../atoms/atoms.ts";
import type { Child } from "../../kernel/dom.ts";

/** The teardown handle handed to a modal action's onClick. */
export interface ModalApi {
  close: () => void;
}

export interface ModalAction {
  label: string;
  variant?: ButtonVariant;
  /** Receives `{ close }` so an action can dismiss the modal. */
  onClick?: (api: ModalApi) => void;
}

export interface ModalCfg {
  title: string;
  body?: Child;
  actions?: ModalAction[];
}

export interface ModalHandle {
  el: HTMLElement;
  close: () => void;
}

export function openModal(cfg: ModalCfg): ModalHandle {
  const overlay = el("div", { class: "amu-modal-overlay", role: "dialog", "aria-modal": "true" });
  const foot = el("div", { class: "amu-modal-foot" });
  const box = el(
    "div",
    { class: "amu-modal" },
    el("h2", { class: "amu-modal-title" }, cfg.title),
    el("div", { class: "amu-modal-body" }, cfg.body ?? ""),
    foot,
  );
  function close(): void {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") close();
  }
  for (const a of cfg.actions ?? []) {
    const action = a;
    foot.append(
      button({
        label: action.label,
        variant: action.variant,
        onClick: () => action.onClick?.({ close }),
      }),
    );
  }
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  overlay.append(box);
  document.body.append(overlay);
  box.querySelector<HTMLElement>("input, select, button")?.focus();
  return { el: overlay, close };
}

export interface ConfirmModalCfg {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function confirmModal(cfg: ConfirmModalCfg): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    openModal({
      title: cfg.title,
      body: el("p", { class: "amu-modal-text" }, cfg.message ?? ""),
      actions: [
        {
          label: "Cancel",
          variant: "ghost",
          onClick: ({ close }) => {
            close();
            resolve(false);
          },
        },
        {
          label: cfg.confirmLabel ?? "Confirm",
          variant: cfg.danger ? "danger" : "accent",
          onClick: ({ close }) => {
            close();
            resolve(true);
          },
        },
      ],
    });
  });
}
