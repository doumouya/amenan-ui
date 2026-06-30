/* dom.ts — tiny DOM helpers every module shares. No framework, no magic. Strict
   TS: `el` is overloaded on keyof HTMLElementTagNameMap so el("button", …)
   infers HTMLButtonElement; `esc` HTML-escapes; `qs` is a scoped querySelector. */

/** An attribute bag for `el`. `class` maps to className; `on*` + a function maps
    to addEventListener; everything else is a string attribute (nullish-skipped). */
export type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

/** A child for `el`: a node, a primitive coerced to a text node, or nullish
    (skipped). Arrays are flattened one level (the source's `children.flat()`). */
export type Child = Node | string | number | boolean | null | undefined | Child[];

/** HTML-escape a value for safe interpolation into markup. */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Create an element with attributes + children.
    `class` → className; `on*` + function → addEventListener; nullish attrs and
    children are skipped; children are flattened and primitives become text nodes.
    Uses appendChild (not append) so the same code drives a real DOM and a minimal
    shim — behaviour is identical (each child is coerced individually here). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null) continue;
    if (k === "class") node.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2), v as EventListener);
    } else node.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity as 1) as Exclude<Child, Child[]>[]) {
    if (c == null) continue;
    // Faithful to the source's `c.nodeType ? c : createTextNode(...)`: a Node is
    // appended as-is, a primitive becomes a text node. Using the nodeType duck
    // test (not `instanceof Node`) keeps this working where `Node` isn't a global.
    const isNode = typeof c === "object" && c !== null && "nodeType" in c;
    node.appendChild(isNode ? (c as unknown as Node) : document.createTextNode(String(c)));
  }
  return node;
}

/** querySelector scoped shorthand, typed to the caller's expected element. */
export function qs<E extends Element>(root: ParentNode, sel: string): E | null {
  return root.querySelector<E>(sel);
}
