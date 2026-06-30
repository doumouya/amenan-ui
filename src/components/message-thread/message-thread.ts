/* message-thread — a channel's message feed + a Markdown composer. Each body is
   rendered through the SAFE markdown renderer (never raw HTML). While mounted it
   POLLS the injected source for new messages; the composer is the textarea atom +
   a Write/Preview toggle + a formatting toolbar (wraps/prefixes the selection with
   Markdown) + a Send that calls the injected send() callback.

   DECOUPLING (AC-H3): NO data fetch literal. The feed comes from the INJECTED
   `config.source: Source<Message[]>` (polled with `{ after: <cursor> }`); a new
   message is sent via the INJECTED `config.send(text) -> Promise<Message>`
   callback; an optional `config.onRead(at)` marks the channel read. There is no
   channel/messages route knowledge here.

   Composes atoms (button/textarea), empty-state, markdown (W3 — never innerHTML),
   toast, and the format helpers. Sole owner of every .amu-mt* class (R4).

   mountMessageThread(host, { source, send, onRead?, pollMs?, emptyTitle?,
     emptyLine?, placeholder? }) → { el, destroy } */

import { el } from "../../kernel/dom.ts";
import { button, textarea } from "../atoms/atoms.ts";
import { mountEmptyState } from "../empty-state/empty-state.ts";
import { renderMarkdown } from "../markdown/markdown.ts";
import { toast } from "../toast/toast.ts";
import { fmtDateTime, initials } from "../../kernel/format.ts";
import type { MountHandle, Source } from "../../contract/index.ts";

const DEFAULT_POLL_MS = 4000;

/** One message. `id` dedups the poll; `author` drives the avatar/initials;
    `at` is an ISO timestamp (the poll cursor); `body` is Markdown TEXT. */
export interface Message {
  id?: string;
  author?: string;
  at?: string;
  body?: string;
}

export interface MessageThreadCfg {
  /** The injected feed source — `source({ after })` → new messages since the
      cursor (the first call passes no cursor for the initial load). */
  source: Source<Message[]>;
  /** Send a composed body; resolves to the created message (appended to the
      feed). Rejecting surfaces a toast (the body is kept). */
  send: (text: string) => Promise<Message>;
  /** Optional: mark the channel read up to the latest cursor after a pull. */
  onRead?: (at: string) => void;
  /** Poll interval in ms (default 4000). */
  pollMs?: number;
  emptyTitle?: string;
  emptyLine?: string;
  placeholder?: string;
}

// toolbar edits over the <textarea> selection.
function wrap(ta: HTMLTextAreaElement, before: string, after: string): void {
  const s = ta.selectionStart ?? ta.value.length;
  const e = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, s) + before + ta.value.slice(s, e) + after + ta.value.slice(e);
  ta.focus();
}
function prefixLines(ta: HTMLTextAreaElement, prefix: string): void {
  const s = ta.selectionStart ?? 0;
  const e = ta.selectionEnd ?? 0;
  const start = ta.value.lastIndexOf("\n", s - 1) + 1;
  const block = ta.value
    .slice(start, e)
    .split("\n")
    .map((l) => prefix + l)
    .join("\n");
  ta.value = ta.value.slice(0, start) + block + ta.value.slice(e);
  ta.focus();
}

/** Pull the messages out of a source response — accepts a bare array or a
    `{ rows | items }` envelope (defensive; the source may wrap). */
function rowsOf(out: unknown): Message[] {
  if (Array.isArray(out)) return out as Message[];
  if (out && typeof out === "object") {
    const o = out as { rows?: unknown; items?: unknown };
    if (Array.isArray(o.rows)) return o.rows as Message[];
    if (Array.isArray(o.items)) return o.items as Message[];
  }
  return [];
}

export function mountMessageThread(host: Element, cfg: MessageThreadCfg): MountHandle {
  const pollMs = cfg.pollMs ?? DEFAULT_POLL_MS;
  const root = el("div", { class: "amu-mt" });
  const feed = el("div", { class: "amu-mt-feed" });
  const composer = el("div", { class: "amu-mt-composer" });
  root.append(feed, composer);
  host.append(root);

  let cursor: string | null = null; // last seen message timestamp (poll cursor)
  let timer: ReturnType<typeof setInterval> | null = null;
  let alive = true;
  let busy = false;
  const seen = new Set<string>(); // ids already rendered (poll dedup)

  function addMessage(m: Message): void {
    const id = m.id;
    if (!id || seen.has(id)) return;
    seen.add(id);
    feed.append(
      el(
        "div",
        { class: "amu-mt-msg" },
        el("div", { class: "amu-mt-avatar" }, initials(m.author ?? "")),
        el(
          "div",
          { class: "amu-mt-msg-body" },
          el(
            "div",
            { class: "amu-mt-msg-meta" },
            el("span", { class: "amu-mt-author" }, m.author || "Unknown"),
            el("span", { class: "amu-mt-time" }, fmtDateTime(m.at)),
          ),
          renderMarkdown(m.body ?? ""),
        ),
      ),
    );
    if (m.at) cursor = m.at;
    feed.scrollTop = feed.scrollHeight;
  }

  function emptyFeed(): void {
    feed.replaceChildren();
    const h = el("div", { class: "amu-mt-empty" });
    feed.append(h);
    mountEmptyState(h, {
      title: cfg.emptyTitle ?? "No messages yet",
      line: cfg.emptyLine ?? "Start the conversation below.",
    });
  }

  async function pull(initial: boolean): Promise<void> {
    let out: Message[];
    try {
      out = rowsOf(await cfg.source(cursor ? { after: cursor } : {}));
    } catch {
      if (initial && !seen.size) emptyFeed(); // source absent / error → empty-state on first load
      return;
    }
    if (!alive) return;
    if (initial && !out.length && !seen.size) {
      emptyFeed();
      return;
    }
    if (out.length && feed.querySelector(".amu-mt-empty")) feed.replaceChildren();
    out.forEach(addMessage);
    if (out.length && cursor && cfg.onRead) cfg.onRead(cursor);
  }

  // ── composer: Write/Preview · toolbar · textarea · Send ─────────────────────
  const ta = textarea({ placeholder: cfg.placeholder ?? "Write a message…  (Markdown supported)", rows: 3 });
  const preview = el("div", { class: "amu-mt-preview" });
  preview.hidden = true;

  const tool = (icon: string, title: string, fn: () => void): HTMLButtonElement =>
    button({ icon, title, variant: "ghost", size: "sm", onClick: fn });
  const toolbar = el(
    "div",
    { class: "amu-mt-toolbar" },
    tool("bi-type-bold", "Bold", () => wrap(ta, "**", "**")),
    tool("bi-type-italic", "Italic", () => wrap(ta, "_", "_")),
    tool("bi-code", "Code", () => wrap(ta, "`", "`")),
    tool("bi-link-45deg", "Link", () => wrap(ta, "[", "](https://)")),
    tool("bi-list-ul", "List", () => prefixLines(ta, "- ")),
    tool("bi-quote", "Quote", () => prefixLines(ta, "> ")),
  );

  const writeTab = button({ label: "Write", variant: "ghost", size: "sm", onClick: () => setMode("write") });
  const previewTab = button({ label: "Preview", variant: "ghost", size: "sm", onClick: () => setMode("preview") });
  function setMode(m: "write" | "preview"): void {
    const w = m !== "preview";
    writeTab.classList.toggle("is-active", w);
    previewTab.classList.toggle("is-active", !w);
    ta.hidden = !w;
    toolbar.hidden = !w;
    preview.hidden = w;
    if (!w) preview.replaceChildren(renderMarkdown(ta.value.trim() || "_Nothing to preview_"));
  }

  const send = button({
    label: "Send",
    icon: "bi-send",
    variant: "accent",
    onClick: async () => {
      if (busy) return;
      const body = ta.value.trim();
      if (!body) {
        toast({ message: "Message is empty", tone: "danger" });
        return;
      }
      busy = true;
      send.disabled = true;
      try {
        const m = await cfg.send(body);
        if (feed.querySelector(".amu-mt-empty")) feed.replaceChildren();
        addMessage(m);
        ta.value = "";
        setMode("write");
      } catch (e) {
        toast({ message: (e instanceof Error && e.message) || "Couldn't send the message", tone: "danger" });
      } finally {
        busy = false;
        send.disabled = false;
      }
    },
  });

  composer.append(
    el(
      "div",
      { class: "amu-mt-composer-head" },
      el("div", { class: "amu-mt-tabs" }, writeTab, previewTab),
      toolbar,
    ),
    ta,
    preview,
    el("div", { class: "amu-mt-composer-actions" }, send),
  );
  setMode("write");

  void pull(true);
  timer = setInterval(() => {
    if (alive) void pull(false);
  }, pollMs);

  return {
    el: root,
    destroy: () => {
      alive = false;
      if (timer) clearInterval(timer);
      root.remove();
    },
  };
}
