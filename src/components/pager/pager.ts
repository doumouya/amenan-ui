/* pager — rows info + a numbered page window (≤5 around the current page) with
   prev/next. mountPager(host, {page, pages, total, onPage}). Sole owner of
   .amu-pager*. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface PagerCfg {
  page: number;
  pages: number;
  total: number;
  onPage?: (page: number) => void;
}

export type PagerUpdate = Partial<PagerCfg>;

interface BtnOpts {
  active?: boolean;
  disabled?: boolean;
}

export function mountPager(host: Element, cfg: PagerCfg): MountHandle<PagerUpdate> {
  const node = el("div", { class: "amu-pager" });

  function render({ page, pages, total }: PagerCfg): void {
    const btn = (label: string, p: number, opts: BtnOpts = {}): HTMLButtonElement => {
      const b = el(
        "button",
        {
          class: `amu-pager-btn${opts.active ? " is-active" : ""}`,
          type: "button",
          onclick: () => cfg.onPage?.(p),
        },
        label,
      );
      if (opts.disabled) b.disabled = true;
      return b;
    };
    // numbered window of ≤5 around the current page
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    const end = Math.min(pages, start + 4);
    const numbers: HTMLButtonElement[] = [];
    for (let p = start; p <= end; p++) numbers.push(btn(String(p), p, { active: p === page }));
    node.replaceChildren(
      el("span", {}, `${total.toLocaleString()} rows`),
      el(
        "span",
        { class: "amu-pager-pages" },
        btn("‹", page - 1, { disabled: page <= 1 }),
        ...numbers,
        btn("›", page + 1, { disabled: page >= pages }),
      ),
    );
  }
  render(cfg);
  host.append(node);
  return {
    el: node,
    update: (p: PagerUpdate) => render({ ...cfg, ...p }),
    destroy: () => node.remove(),
  };
}
