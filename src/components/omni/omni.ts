/* omni — the global OMNISEARCH: a pill (search icon + input + Ctrl-K hint) plus a
   results dropdown. A click on a result fires `config.onSelect(result)` (each
   result carries a ready `hash`/href the consumer routes to). Ctrl/Cmd+K focuses
   it (bound once for the app's life). Keyboard nav (↑↓/Enter/Esc), 200ms debounce,
   abortable.

   DECOUPLING (AC-H3): NO data fetch literal — results come from the INJECTED
   `config.source: Source<OmniResult[]>` (the consumer's reach-scoped search). NO
   hardcoded result-kind list — kinds are CONFIG-driven (`config.kinds` supplies
   each kind's label + icon; unknown kinds degrade to a titlecased plural + a dot).
   Composes the kbd atom. Sole owner of every .amu-omni* class (ui-fork-audit R4).

   mountOmni(host, { source, onSelect?, kinds?, placeholder?, limit? })
     → { el, focus(), destroy() } */

import { el } from "../../kernel/dom.ts";
import { kbd } from "../atoms/atoms.ts";
import type { MountHandle, Source } from "../../contract/index.ts";

/** One search hit. `kind` groups results (labelled/iconed via config.kinds);
    `hash`/`href` is the ready destination the consumer routes to on select. */
export interface OmniResult {
  kind: string;
  label: string;
  sub?: string;
  hash?: string;
  href?: string;
  /** An opaque id passthrough for the consumer's onSelect. */
  id?: string;
}

/** A kind's display chrome (the consumer owns the vocabulary — no hardcoded
    project/file/chart list here). */
export interface OmniKind {
  label?: string;
  /** A Bootstrap Icons name (e.g. "bi-folder"); defaults to "bi-dot". */
  icon?: string;
}

export interface OmniCfg {
  /** The injected search source — `source({ q, limit })` → results. */
  source: Source<OmniResult[]>;
  /** Called when a result is chosen (click or Enter). The consumer routes to
      `result.hash`/`result.href`. */
  onSelect?: (result: OmniResult) => void;
  /** Per-kind label + icon. Unknown kinds degrade to a titlecased plural + dot. */
  kinds?: Record<string, OmniKind>;
  placeholder?: string;
  /** Max results to request (passed through to the source query). Default 20. */
  limit?: number;
}

export interface OmniHandle extends MountHandle {
  focus: () => void;
}

// The Ctrl/Cmd+K handler binds once for the app's life and focuses whichever
// omnibox is currently mounted.
let ctrlKBound = false;

export function mountOmni(host: Element, cfg: OmniCfg): OmniHandle {
  const kinds = cfg.kinds ?? {};
  const limit = cfg.limit ?? 20;
  const kindLabel = (k: string): string =>
    kinds[k]?.label ?? (k.charAt(0).toUpperCase() + k.slice(1) + "s");
  const kindIcon = (k: string): string => "bi " + (kinds[k]?.icon ?? "bi-dot");

  const field = el("input", {
    type: "search",
    placeholder: cfg.placeholder ?? "Search…",
    "aria-label": "Search",
  });
  const menu = el("div", { class: "amu-omni-menu" });
  menu.hidden = true;
  const box = el(
    "div",
    { class: "amu-omni" },
    el("i", { class: "bi bi-search" }),
    field,
    kbd("Ctrl K"),
    menu,
  );

  let results: OmniResult[] = [];
  let cursor = -1;
  let lastQ = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: AbortController | null = null;

  const close = (): void => {
    menu.hidden = true;
    cursor = -1;
  };
  const open = (): void => {
    menu.hidden = false;
  };

  async function search(q: string): Promise<void> {
    if (inflight) inflight.abort();
    inflight = new AbortController();
    try {
      const data = await cfg.source({ q, limit, signal: inflight.signal });
      results = Array.isArray(data) ? data : [];
      cursor = results.length ? 0 : -1;
      render(q);
      open();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // newer keystroke won
      const status = (err as { status?: number } | null)?.status;
      menu.replaceChildren(
        el("div", { class: "amu-omni-state" }, "Search failed" + (status ? ` (${status})` : "") + "."),
      );
      open();
    }
  }

  function render(q: string): void {
    if (!results.length) {
      menu.replaceChildren(el("div", { class: "amu-omni-state" }, "No results."));
      return;
    }
    const kids: Node[] = [];
    let lastKind: string | null = null;
    results.forEach((r, idx) => {
      if (r.kind !== lastKind) {
        kids.push(el("div", { class: "amu-omni-section" }, kindLabel(r.kind)));
        lastKind = r.kind;
      }
      kids.push(resultEl(r, idx, q));
    });
    menu.replaceChildren(...kids);
  }

  function resultEl(r: OmniResult, idx: number, q: string): HTMLElement {
    const label = el("span", { class: "amu-omni-result-label" });
    const hay = (r.label || "").toLowerCase();
    const hit = q ? hay.indexOf(q.toLowerCase()) : -1;
    if (hit < 0) {
      label.textContent = r.label || "";
    } else {
      // text nodes + a highlighted span — no innerHTML, so q is never markup.
      label.append(
        document.createTextNode(r.label.slice(0, hit)),
        el("span", { class: "amu-omni-hl" }, r.label.slice(hit, hit + q.length)),
        document.createTextNode(r.label.slice(hit + q.length)),
      );
    }
    return el(
      "button",
      {
        class: "amu-omni-result" + (idx === cursor ? " is-active" : ""),
        type: "button",
        "data-idx": String(idx),
      },
      el("i", { class: kindIcon(r.kind) }),
      label,
      r.sub ? el("span", { class: "amu-omni-result-sub" }, r.sub) : null,
    );
  }

  function scrollCursorIntoView(): void {
    menu.querySelector(".amu-omni-result.is-active")?.scrollIntoView({ block: "nearest" });
  }

  function choose(r: OmniResult): void {
    close();
    field.value = "";
    lastQ = "";
    results = [];
    cfg.onSelect?.(r);
  }

  field.addEventListener("input", () => {
    const q = field.value.trim();
    if (q === lastQ) return;
    lastQ = q;
    if (timer) clearTimeout(timer);
    if (!q) {
      close();
      return;
    }
    timer = setTimeout(() => void search(q), 200);
  });

  field.addEventListener("focus", () => {
    if (results.length && field.value.trim()) open();
  });

  field.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      field.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      cursor = (cursor + 1) % results.length;
      render(lastQ);
      scrollCursorIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cursor = (cursor - 1 + results.length) % results.length;
      render(lastQ);
      scrollCursorIntoView();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = cursor >= 0 ? results[cursor] : undefined;
      if (r) choose(r);
    }
  });

  // mousedown (not click) so it fires before the input's blur closes the menu.
  menu.addEventListener("mousedown", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const btn = target?.closest<HTMLElement>(".amu-omni-result");
    if (!btn) return;
    e.preventDefault();
    const idx = Number.parseInt(btn.dataset.idx ?? "", 10);
    const r = Number.isFinite(idx) ? results[idx] : undefined;
    if (r) choose(r);
  });

  const onDocDown = (e: MouseEvent): void => {
    const target = e.target instanceof Node ? e.target : null;
    if (!target || !box.contains(target)) close();
  };
  document.addEventListener("mousedown", onDocDown);

  if (!ctrlKBound) {
    ctrlKBound = true;
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        const omni = document.querySelector<HTMLInputElement>(".amu-omni input");
        if (omni) {
          e.preventDefault();
          omni.focus();
        }
      }
    });
  }

  host.append(box);

  return {
    el: box,
    focus: () => field.focus(),
    destroy: () => {
      if (timer) clearTimeout(timer);
      if (inflight) inflight.abort();
      document.removeEventListener("mousedown", onDocDown);
      box.remove();
    },
  };
}
