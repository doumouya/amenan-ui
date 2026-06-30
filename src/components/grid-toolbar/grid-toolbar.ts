/* grid-toolbar — a DATA-DRIVEN control strip above a grid. The toolbar is a spec
   of controls; it renders them, runs ONE delegated handler, and reports every
   action through onAction(id, ctx). It holds NO behavior of its own —
   mutual-exclusion within a toggle group, what a search does, etc. are the
   CONSUMER's concern (the toolbar just reports the click + exposes setActive/
   setDisabled so the consumer can reflect state).

   mountGridToolbar(host, {
     controls: [ControlSpec],   // tagged union by `kind` (see below)
     onAction(id, ctx),         // ctx: {value?} search · {menu?} menu item
     state,                     // opaque; passed to when/active/visible/label
   }) → { el, update({state, controls}), setActive(id,bool),
          setDisabled(id,bool), destroy }

   when=false → the button is hidden+disabled. `active`/`visible`/`label(state)`
   are re-evaluated on update(state). onAction receives ctx: search carries
   {value}, a menu item carries {menu: <menu id>}.

   Composes atoms.button + mountMenu + atoms.input; every .amu-gtb* class is owned
   solely by grid-toolbar.css (ui-fork-audit R4). */

import { el } from "../../kernel/dom.ts";
import { button, input } from "../atoms/atoms.ts";
import type { ButtonVariant } from "../atoms/atoms.ts";
import { mountMenu } from "../menu/menu.ts";
import type { MountHandle } from "../../contract/index.ts";

/** Opaque consumer state passed to the per-control predicates. */
export type ToolbarState = unknown;

export interface SearchControl<S = ToolbarState> {
  kind: "search";
  id: string;
  placeholder?: string;
  value?: string;
  onInput?: (q: string) => void;
  /** marker so the union can carry it harmlessly; unused by search. */
  when?: (state: S) => boolean;
}
export interface ButtonControl<S = ToolbarState> {
  kind: "button";
  id: string;
  icon?: string;
  label?: string;
  title?: string;
  variant?: ButtonVariant;
  when?: (state: S) => boolean;
}
export interface ToggleControl<S = ToolbarState> {
  kind: "toggle";
  id: string;
  icon?: string;
  label?: string;
  title?: string;
  variant?: ButtonVariant;
  group?: string;
  active?: (state: S) => boolean;
}
export interface MenuControlItem {
  id: string;
  label: string;
  icon?: string;
}
export interface MenuControl<S = ToolbarState> {
  kind: "menu";
  id: string;
  icon?: string;
  label?: string;
  title?: string;
  variant?: ButtonVariant;
  items?: MenuControlItem[];
  when?: (state: S) => boolean;
}
export interface ChipControl<S = ToolbarState> {
  kind: "chip";
  id: string;
  label?: (state: S) => string;
  visible?: (state: S) => boolean;
}
export interface SepControl {
  kind: "sep";
}

export type ControlSpec<S = ToolbarState> =
  | SearchControl<S>
  | ButtonControl<S>
  | ToggleControl<S>
  | MenuControl<S>
  | ChipControl<S>
  | SepControl;

/** Context passed to onAction: a search carries {value}, a menu item {menu}. */
export interface ActionCtx {
  value?: string;
  menu?: string;
}

export interface GridToolbarCfg<S = ToolbarState> {
  controls?: ControlSpec<S>[];
  onAction?: (id: string, ctx: ActionCtx) => unknown;
  state?: S;
}

export interface GridToolbarUpdate<S = ToolbarState> {
  state?: S;
  controls?: ControlSpec<S>[];
}

export interface GridToolbarHandle<S = ToolbarState> extends MountHandle<GridToolbarUpdate<S>> {
  setActive: (id: string, on: boolean) => void;
  setDisabled: (id: string, off: boolean) => void;
}

interface RegEntry<S> {
  spec: ControlSpec<S>;
  node: HTMLElement;
  kind: ControlSpec<S>["kind"];
  menuHandle?: MountHandle;
  searchInput?: HTMLInputElement;
}

export function mountGridToolbar<S = ToolbarState>(
  host: Element,
  cfg: GridToolbarCfg<S>,
): GridToolbarHandle<S> {
  let controls = cfg.controls ?? [];
  let state = cfg.state;

  const root = el("div", { class: "amu-gtb", role: "toolbar" });
  // id → entry for update + the setActive/setDisabled handle methods.
  const reg = new Map<string, RegEntry<S>>();

  function render(): void {
    reg.clear();
    const nodes = controls.map(buildControl).filter((n): n is HTMLElement => n != null);
    root.replaceChildren(...nodes);
    refresh();
  }

  function buildControl(spec: ControlSpec<S>): HTMLElement | null {
    if (spec.kind === "sep") {
      return el("span", { class: "amu-gtb-sep", "aria-hidden": "true" });
    }
    if (spec.kind === "search") {
      const field = input({
        type: "search",
        placeholder: spec.placeholder ?? "Search…",
        onInput: (q) => {
          spec.onInput?.(q);
          cfg.onAction?.(spec.id, { value: q });
        },
      });
      // value carried on the spec so a re-render (controls rebuilt) preserves
      // what's typed — the consumer keeps the query in its toolbar state.
      if (spec.value != null) field.value = spec.value;
      field.classList.add("amu-gtb-input"); // own class for the icon-padding
      const wrap = el(
        "div",
        { class: "amu-gtb-search" },
        el("i", { class: "amu-gtb-search-icon bi bi-search" }),
        field,
      );
      reg.set(spec.id, { spec, node: wrap, kind: "search", searchInput: field });
      return wrap;
    }
    if (spec.kind === "chip") {
      const c = el("button", { class: "amu-gtb-chip", type: "button", "data-gtb": spec.id }, "");
      reg.set(spec.id, { spec, node: c, kind: "chip" });
      return c;
    }
    if (spec.kind === "menu") {
      const trigger = button({
        icon: spec.icon,
        label: spec.label,
        title: spec.title,
        variant: spec.variant ?? "ghost",
      });
      const wrap = el("div", { class: "amu-gtb-item" });
      const handle = mountMenu(wrap, {
        trigger,
        items: (spec.items ?? []).map((it) => ({
          label: it.label,
          icon: it.icon,
          onSelect: () => cfg.onAction?.(it.id, { menu: spec.id }),
        })),
      });
      reg.set(spec.id, { spec, node: wrap, kind: "menu", menuHandle: handle });
      return wrap;
    }
    // button + toggle share the atom; the only difference is which predicate
    // governs them and that a toggle carries a group + an aria-pressed state.
    const btn = button({
      icon: spec.icon,
      label: spec.label,
      title: spec.title,
      variant: spec.variant ?? "ghost",
    });
    btn.dataset.gtb = spec.id;
    if (spec.kind === "toggle") {
      btn.classList.add("amu-gtb-toggle");
      if (spec.group != null) btn.dataset.gtbGroup = spec.group;
      btn.setAttribute("aria-pressed", "false");
    }
    reg.set(spec.id, { spec, node: btn, kind: spec.kind });
    return btn;
  }

  // re-evaluate the per-control predicates against the current state.
  function refresh(): void {
    for (const entry of reg.values()) {
      const { spec, node, kind } = entry;
      if (kind === "button" && spec.kind === "button") {
        const ok = spec.when ? !!spec.when(state as S) : true;
        node.classList.toggle("is-hidden", !ok);
        (node as HTMLButtonElement).disabled = !ok;
      } else if (kind === "toggle" && spec.kind === "toggle") {
        const on = spec.active ? !!spec.active(state as S) : node.classList.contains("is-active");
        node.classList.toggle("is-active", on);
        node.setAttribute("aria-pressed", on ? "true" : "false");
      } else if (kind === "chip" && spec.kind === "chip") {
        const vis = spec.visible ? !!spec.visible(state as S) : true;
        node.classList.toggle("is-hidden", !vis);
        node.textContent = spec.label ? spec.label(state as S) : "";
      }
    }
  }

  // ── ONE delegated handler — every button/toggle/chip click routes here by
  //    data-gtb (search/menu report through their own atom callbacks). ──────
  root.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const t = target?.closest<HTMLElement>("[data-gtb]");
    if (!t || !root.contains(t) || (t as HTMLButtonElement).disabled) return;
    const id = t.dataset.gtb;
    if (id == null) return;
    const r = cfg.onAction?.(id, {});
    // A promise-returning action spins the button's icon until it settles — the
    // refresh button (its onAction returns reload()) rotates while reloading.
    // Floor it at one full rotation so a fast reload still reads as a spin, not
    // a flicker (the data is already in by then — this is just feedback).
    if (isPromiseLike(r) && !t.classList.contains("is-spinning")) {
      t.classList.add("is-spinning");
      const minSpin = new Promise<void>((res) => setTimeout(res, 700));
      Promise.allSettled([Promise.resolve(r), minSpin]).then(() =>
        t.classList.remove("is-spinning"),
      );
    }
  });

  render();
  host.append(root);

  return {
    el: root,
    update: (p: GridToolbarUpdate<S> = {}) => {
      if ("state" in p) state = p.state;
      if (p.controls) {
        controls = p.controls;
        render();
      } else refresh();
    },
    /** Reflect a toggle's on/off (the consumer enforces group exclusivity). */
    setActive: (id: string, on: boolean) => {
      const e = reg.get(id);
      if (!e) return;
      e.node.classList.toggle("is-active", !!on);
      e.node.setAttribute("aria-pressed", on ? "true" : "false");
    },
    setDisabled: (id: string, off: boolean) => {
      const e = reg.get(id);
      if (e) (e.node as HTMLButtonElement).disabled = !!off;
    },
    destroy: () => {
      for (const { menuHandle } of reg.values()) menuHandle?.destroy?.();
      root.remove();
    },
  };
}

function isPromiseLike(v: unknown): v is PromiseLike<unknown> {
  return v != null && typeof (v as { then?: unknown }).then === "function";
}
