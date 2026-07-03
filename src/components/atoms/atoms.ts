/* atoms — builder functions for the lowest-level vocabulary. Pages and
   components call these instead of writing markup by hand. Each returns a raw
   element; a composed component imports the leaf rather than re-implementing it.
   Sole owner of the .amu-btn / .amu-chip / .amu-input / .amu-textarea /
   .amu-badge / .amu-spinner / .amu-kbd / .amu-icon namespaces. */

import { el } from "../../kernel/dom.ts";

export type ButtonVariant = "accent" | "ghost" | "danger";
export type BadgeTone = "ok" | "warn" | "danger" | "info" | "accent";

export interface ButtonCfg {
  label?: string;
  /** A Bootstrap Icons name (e.g. "bi-layout-sidebar"). */
  icon?: string;
  variant?: ButtonVariant;
  /** Only "sm" is defined today; widen if more sizes land. */
  size?: "sm";
  onClick?: EventListener;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  ariaLabel?: string;
}

/** A text (or icon-only) button. `icon` + no `label` renders a square icon-only
    button (.amu-btn--icon); always give an icon-only button a title/ariaLabel. */
export function button(cfg: ButtonCfg): HTMLButtonElement {
  const cls = ["amu-btn"];
  if (cfg.variant) cls.push(`amu-btn--${cfg.variant}`);
  if (cfg.size) cls.push(`amu-btn--${cfg.size}`);
  if (cfg.icon && cfg.label == null) cls.push("amu-btn--icon");
  const b = el(
    "button",
    {
      class: cls.join(" "),
      type: cfg.type ?? "button",
      onclick: cfg.onClick,
      title: cfg.title ?? null,
      "aria-label": cfg.ariaLabel ?? cfg.title ?? null,
    },
    cfg.icon ? el("i", { class: "bi " + cfg.icon }) : null,
    cfg.label ?? null,
  );
  if (cfg.disabled) b.disabled = true;
  return b;
}

export interface ChipCfg {
  label: string;
  active?: boolean;
  onClick?: EventListener;
}

/** A pill selector (single-select rows live in chip-row). */
export function chip(cfg: ChipCfg): HTMLButtonElement {
  return el(
    "button",
    {
      class: `amu-chip${cfg.active ? " is-active" : ""}`,
      type: "button",
      onclick: cfg.onClick,
      "aria-pressed": cfg.active ? "true" : "false",
    },
    cfg.label,
  );
}

export interface InputCfg {
  placeholder?: string;
  value?: string;
  type?: string;
  onInput?: (value: string) => void;
  onEnter?: (value: string) => void;
}

/** A single-line text input. */
export function input(cfg: InputCfg = {}): HTMLInputElement {
  const i = el("input", {
    class: "amu-input",
    type: cfg.type ?? "text",
    placeholder: cfg.placeholder ?? "",
  });
  if (cfg.value != null) i.value = cfg.value;
  const onInput = cfg.onInput;
  if (onInput) i.addEventListener("input", () => onInput(i.value));
  const onEnter = cfg.onEnter;
  if (onEnter) {
    i.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onEnter(i.value);
    });
  }
  return i;
}

export interface TextareaCfg {
  placeholder?: string;
  value?: string;
  rows?: number;
  onInput?: (value: string) => void;
}

/** The multiline `input`. */
export function textarea(cfg: TextareaCfg = {}): HTMLTextAreaElement {
  const t = el("textarea", {
    class: "amu-textarea",
    placeholder: cfg.placeholder ?? "",
    rows: String(cfg.rows ?? 3),
  });
  if (cfg.value != null) t.value = cfg.value;
  const onInput = cfg.onInput;
  if (onInput) t.addEventListener("input", () => onInput(t.value));
  return t;
}

export interface BadgeCfg {
  label: string;
  tone?: BadgeTone;
}

/** A soft-tint label pill (status / role / plan). */
export function badge(cfg: BadgeCfg): HTMLSpanElement {
  return el(
    "span",
    { class: `amu-badge${cfg.tone ? ` amu-badge--${cfg.tone}` : ""}` },
    cfg.label,
  );
}

/** Async feedback (used sparingly — optimistic UI first). */
export function spinner(): HTMLSpanElement {
  return el("span", { class: "amu-spinner", role: "status", "aria-label": "Loading" });
}

/** A keyboard hint. */
export function kbd(label: string): HTMLElement {
  return el("kbd", { class: "amu-kbd" }, label);
}

export interface IconCfg {
  /** Font-size (any CSS length); defaults to the surrounding text size. */
  size?: string;
  /** Color (a token reference like "var(--accent)"); defaults to currentColor. */
  color?: string;
  /** Accessible name — give one ONLY when the icon carries meaning on its own;
      decorative icons (paired with text) stay aria-hidden. */
  label?: string;
}

/** A Bootstrap Icons glyph: `icon("funnel")` → `<i class="bi bi-funnel">`.
    Takes the BARE icon name (no "bi-" prefix — unlike ButtonCfg.icon, which
    predates this atom and keeps its prefixed form). The host page provides the
    bootstrap-icons stylesheet; glyphs inherit currentColor so they sit against
    hairlines and take the text/accent color for free. */
export function icon(name: string, cfg: IconCfg = {}): HTMLElement {
  const style =
    (cfg.size ? `font-size:${cfg.size};` : "") + (cfg.color ? `color:${cfg.color};` : "");
  return el("i", {
    class: `amu-icon bi bi-${name}`,
    style: style || null,
    role: cfg.label ? "img" : null,
    "aria-label": cfg.label ?? null,
    "aria-hidden": cfg.label ? null : "true",
  });
}
