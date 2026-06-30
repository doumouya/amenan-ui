/* code — inline / block monospace snippet (AC-20), ported from web-kit's `code`
   to amenan conventions: classes `.amu-code*` (renamed from the web-kit prefix), a
   co-located CSS sheet `@import`ed by styles.css (NOT `ensureStyles`), built on
   the kernel `el`.

   Inline (`<code>`) is the default — a small chip for an identifier / route;
   `block:true` renders a `<pre>` for a multi-line snippet. `tone` tints the inline
   chip (default / accent / muted); `truncate` clips a long inline value with an
   ellipsis.

   Sole owner of every .amu-code* class (ui-fork-audit R4). Scrub-clean. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

export type CodeTone = "default" | "accent" | "muted";

export interface CodeCfg {
  /** The literal snippet text (never interpolated as HTML — set as a text node). */
  text: string;
  block?: boolean;
  tone?: CodeTone;
  truncate?: boolean;
}

export function mountCode(host: Element, cfg: CodeCfg): MountHandle {
  const { text, block, tone = "default", truncate } = cfg;

  let node: HTMLElement;
  if (block) {
    node = el("pre", { class: "amu-code amu-code--block" }, text);
  } else {
    const classes = [
      "amu-code",
      "amu-code--inline",
      tone !== "default" ? `amu-code--${tone}` : null,
      truncate ? "amu-code--truncate" : null,
    ]
      .filter(Boolean)
      .join(" ");
    node = el("code", { class: classes }, text);
  }

  host.appendChild(node);
  return { el: node, update() {}, destroy: () => node.remove() };
}
