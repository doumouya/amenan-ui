// tests/_dom-shim.ts — a minimal, zero-dependency DOM shim for the node:test
// harness (node 24 has no `document`). It is just enough for page-assembly,
// router, and registry tests: element creation, class lists, child trees,
// dataset, a small querySelector (class / tag / [attr] / #id and descendant),
// addEventListener, and a settable `location.hash`. NOT a browser — it only
// implements the surface the units under test touch. This is tester-owned test
// scaffolding (not production code).

type Listener = (ev: unknown) => void;

class ClassList {
  private set = new Set<string>();
  constructor(initial?: string) {
    if (initial) for (const c of initial.split(/\s+/).filter(Boolean)) this.set.add(c);
  }
  add(...cs: string[]) {
    for (const c of cs) this.set.add(c);
  }
  remove(...cs: string[]) {
    for (const c of cs) this.set.delete(c);
  }
  contains(c: string) {
    return this.set.has(c);
  }
  toggle(c: string, force?: boolean) {
    const want = force ?? !this.set.has(c);
    if (want) this.set.add(c);
    else this.set.delete(c);
    return want;
  }
  get value() {
    return [...this.set].join(" ");
  }
  toString() {
    return this.value;
  }
}

export class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  classList: ClassList;
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  textContent = "";
  private listeners = new Map<string, Listener[]>();

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
    this.classList = new ClassList();
  }

  get className() {
    return this.classList.value;
  }
  set className(v: string) {
    this.classList = new ClassList(v);
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
    if (name === "class") this.className = value;
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      this.dataset[key] = value;
    }
  }
  getAttribute(name: string): string | null {
    if (name === "class") return this.className;
    return name in this.attributes ? this.attributes[name]! : null;
  }
  hasAttribute(name: string) {
    return name === "class" ? this.className !== "" : name in this.attributes;
  }

  // the kernel's el() duck-tests `nodeType`; renderMarkdown appends variadically.
  get nodeType(): number {
    return this.tagName === "#TEXT" ? 3 : 1;
  }
  append(...nodes: FakeElement[]) {
    for (const n of nodes) this.appendChild(n);
  }
  appendChild(child: FakeElement) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child: FakeElement) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }
  contains(node: FakeElement | null): boolean {
    if (!node) return false;
    if (node === this) return true;
    return this.children.some((c) => c.contains(node));
  }

  addEventListener(type: string, fn: Listener) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }
  removeEventListener(type: string, fn: Listener) {
    const arr = this.listeners.get(type);
    if (arr) this.listeners.set(type, arr.filter((f) => f !== fn));
  }
  dispatchEvent(type: string, ev: unknown = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn(ev);
  }

  // descendant-or-self match against one simple selector token
  private matchesToken(token: string): boolean {
    if (token.startsWith(".")) return this.classList.contains(token.slice(1));
    if (token.startsWith("#")) return this.attributes["id"] === token.slice(1);
    if (token.startsWith("[")) {
      const m = token.match(/^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
      if (!m) return false;
      const [, attr, val] = m;
      if (val === undefined) return attr! in this.attributes || (attr === "class" && this.className !== "");
      if (attr!.startsWith("data-")) {
        const key = attr!.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return this.dataset[key] === val;
      }
      return this.getAttribute(attr!) === val;
    }
    return this.tagName === token.toUpperCase();
  }

  querySelector(sel: string): FakeElement | null {
    // supports a single compound token (e.g. ".amu-shell") and descendant search
    const token = sel.trim().split(/\s+/).pop()!;
    const dfs = (node: FakeElement): FakeElement | null => {
      for (const c of node.children) {
        if (c.matchesToken(token)) return c;
        const deep = dfs(c);
        if (deep) return deep;
      }
      return null;
    };
    return dfs(this);
  }

  querySelectorAll(sel: string): FakeElement[] {
    const token = sel.trim().split(/\s+/).pop()!;
    const out: FakeElement[] = [];
    const dfs = (node: FakeElement) => {
      for (const c of node.children) {
        if (c.matchesToken(token)) out.push(c);
        dfs(c);
      }
    };
    dfs(this);
    return out;
  }
}

export interface ShimHandles {
  documentElement: FakeElement;
  hashSetLog: string[];
  restore: () => void;
}

// Install the shim onto globalThis. Returns handles + a restore().
export function installDomShim(): ShimHandles {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved: Record<string, unknown> = {};
  for (const k of ["document", "HTMLElement", "Element", "location", "addEventListener", "removeEventListener"]) {
    saved[k] = g[k];
  }

  const documentElement = new FakeElement("html");
  const body = new FakeElement("body");
  documentElement.appendChild(body);

  const doc = {
    documentElement,
    body,
    createElement: (tag: string) => new FakeElement(tag),
    createTextNode: (t: string) => {
      const n = new FakeElement("#text");
      n.textContent = t;
      return n;
    },
    querySelector: (sel: string) => documentElement.querySelector(sel),
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const hashSetLog: string[] = [];
  let _hash = "";
  const location = {
    get hash() {
      return _hash;
    },
    set hash(v: string) {
      _hash = v;
      hashSetLog.push(v);
    },
  };

  const winListeners = new Map<string, Listener[]>();
  g["document"] = doc;
  g["HTMLElement"] = FakeElement;
  g["Element"] = FakeElement;
  g["location"] = location;
  g["addEventListener"] = (type: string, fn: Listener) => {
    const arr = winListeners.get(type) ?? [];
    arr.push(fn);
    winListeners.set(type, arr);
  };
  g["removeEventListener"] = (type: string, fn: Listener) => {
    const arr = winListeners.get(type);
    if (arr) winListeners.set(type, arr.filter((f) => f !== fn));
  };

  return {
    documentElement,
    hashSetLog,
    restore() {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete g[k];
        else g[k] = v;
      }
    },
  };
}
