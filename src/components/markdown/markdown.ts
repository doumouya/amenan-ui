/* markdown — a SAFE, minimal Markdown → DOM renderer. Message/comment bodies are
   stored as TEXT; this builds DOM NODES (every text run via a text node →
   auto-escaped), NEVER innerHTML of user content and NEVER raw-HTML passthrough.
   So a body of `<img src=x onerror=alert(1)>` or `<script>…</script>` renders as
   literal text — no injection, no execution. Links are scheme-checked (http/https/
   mailto only) and open in a new tab (rel=noopener). Everything not recognised is
   literal text.

   Supported: paragraphs (blank-line separated, single newline → <br>), # … ######
   headings, **bold** / __bold__, *italic* / _italic_, `code`, ```fenced``` code,
   > blockquote, - / * and 1. lists, [label](url) links, GFM pipe tables (header
   row + |---| divider; cells through the same safe inline(); a pipe-framed run
   WITHOUT a divider renders as a plain paragraph). Sole owner of .amu-md
   (markdown.css).

   renderMarkdown(text) -> HTMLElement (a .amu-md container). */

import { el } from "../../kernel/dom.ts";

const SAFE_SCHEME = /^(https?:|mailto:)/i;
const BLOCK_LEAD = /^(```|>\s?|\s*[-*]\s+|\s*\d+\.\s+|#{1,6}\s)/;
// a table row is pipe-framed; the divider row (line 2) is pipes/dashes/colons only
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIV = /^\s*\|[\s:|-]*-[\s:|-]*\|\s*$/;

// ── inline spans: emit text nodes + safe inline elements, leftmost-match first.
//    Precedence at a tie: code · link · bold · italic. Nested by re-parsing the
//    captured content (terminates — each level consumes its delimiters).
const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/;

function inline(text: string): Node[] {
  const out: Node[] = [];
  let rest = String(text);
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(document.createTextNode(rest));
      break;
    }
    if (m.index > 0) out.push(document.createTextNode(rest.slice(0, m.index)));
    if (m[1] != null) {
      out.push(el("code", {}, m[1]));
    } else if (m[2] != null) {
      const href = m[3] ?? "";
      out.push(
        SAFE_SCHEME.test(href)
          ? el("a", { href, target: "_blank", rel: "noopener noreferrer" }, ...inline(m[2]))
          : document.createTextNode(m[0]), // unsafe scheme → literal text
      );
    } else if (m[4] != null || m[5] != null) {
      out.push(el("strong", {}, ...inline(m[4] ?? m[5] ?? "")));
    } else if (m[6] != null || m[7] != null) {
      out.push(el("em", {}, ...inline(m[6] ?? m[7] ?? "")));
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

// a run of lines sharing a prefix → one <li>'s inline content.
const listItems = (lines: string[], strip: RegExp): HTMLLIElement[] =>
  lines.map((ln) => el("li", {}, ...inline(ln.replace(strip, ""))));

export function renderMarkdown(text?: string): HTMLElement {
  const root = el("div", { class: "amu-md" });
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const take = (pred: (l: string) => boolean): string[] => {
    const buf: string[] = [];
    while (i < lines.length && pred(lines[i] ?? "")) {
      buf.push(lines[i] ?? "");
      i++;
    }
    return buf;
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (/^```/.test(line)) {
      i++; // opening fence
      const buf = take((l) => !/^```/.test(l));
      i++; // closing fence
      root.append(el("pre", {}, el("code", {}, buf.join("\n"))));
    } else if (/^#{1,6}\s/.test(line)) {
      // heading — one line, level = the # count; text flows through the same safe inline()
      const m = /^(#{1,6})\s+(.*)$/.exec(line);
      const H = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
      root.append(el(H[(m?.[1]?.length ?? 1) - 1] ?? "h1", {}, ...inline(m?.[2] ?? "")));
      i++;
    } else if (/^>\s?/.test(line)) {
      const buf = take((l) => /^>\s?/.test(l)).map((l) => l.replace(/^>\s?/, ""));
      root.append(el("blockquote", {}, ...inline(buf.join("\n"))));
    } else if (/^\s*[-*]\s+/.test(line)) {
      root.append(el("ul", {}, ...listItems(take((l) => /^\s*[-*]\s+/.test(l)), /^\s*[-*]\s+/)));
    } else if (/^\s*\d+\.\s+/.test(line)) {
      root.append(el("ol", {}, ...listItems(take((l) => /^\s*\d+\.\s+/.test(l)), /^\s*\d+\.\s+/)));
    } else if (TABLE_ROW.test(line)) {
      // GFM pipe table: header row, |---| divider, body rows. \| escapes a
      // literal pipe inside a cell. Alignment colons are accepted and ignored.
      const rows = take((l) => TABLE_ROW.test(l));
      if (rows.length >= 2 && TABLE_DIV.test(rows[1] ?? "")) {
        const cells = (r: string): string[] =>
          r.trim().replace(/\\\|/g, "\x00").replace(/^\|/, "").replace(/\|$/, "")
            .split("|").map((c) => c.trim().replace(/\x00/g, "|"));
        const tr = (r: string, tag: "th" | "td") => el("tr", {}, ...cells(r).map((c) => el(tag, {}, ...inline(c))));
        root.append(el("table", {},
          el("thead", {}, tr(rows[0] ?? "", "th")),
          el("tbody", {}, ...rows.slice(2).map((r) => tr(r, "td")))));
      } else {
        // pipe-framed but no divider → not a table; keep the lines as a paragraph
        const p = el("p", {});
        rows.forEach((ln, k) => {
          if (k) p.append(el("br"));
          p.append(...inline(ln));
        });
        root.append(p);
      }
    } else if (line.trim() === "") {
      i++;
    } else {
      const buf = take((l) => l.trim() !== "" && !BLOCK_LEAD.test(l) && !TABLE_ROW.test(l));
      const p = el("p", {});
      buf.forEach((ln, k) => {
        if (k) p.append(el("br"));
        p.append(...inline(ln));
      });
      root.append(p);
    }
  }
  return root;
}
