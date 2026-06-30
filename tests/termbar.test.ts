// tests/termbar.test.ts — AC-17 (TERMBAR ported to amenan conventions).
//
// Imports the REAL src/components/termbar/termbar.ts and asserts:
//   - mountTermbar(host, cfg) → MountHandle whose el carries .amu-termbar
//   - it renders the strip: traffic-light dots + wordmark + cwd + status pill +
//     the toggle (the .amu-termbar-* children)
//   - the toggle is wired to theme.ts toggleMode() (NOT a raw attribute write):
//     clicking it flips getMode() dark↔light
//   - scrub-clean: NO `.dc-`, `.rp-`, or `dc-theme` survives anywhere in the
//     mounted markup
//
// RED now: src/components/termbar/termbar.ts does not exist yet (AC-17 not built)
// → the import resolves to nothing → suite fails.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installDomShim, FakeElement } from "./_dom-shim.ts";

const shim = installDomShim();

// termbar wires to theme.ts (toggleMode/getMode), which needs localStorage.
interface Store {
  map: Map<string, string>;
}
const store: Store = { map: new Map() };
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string): string | null => (store.map.has(k) ? store.map.get(k)! : null),
  setItem: (k: string, v: string): void => {
    store.map.set(k, v);
  },
  removeItem: (k: string): void => {
    store.map.delete(k);
  },
  clear: (): void => store.map.clear(),
};
// matchMedia (the toggle label/sync may consult OS preference as a fallback).
(globalThis as unknown as { matchMedia: unknown }).matchMedia = (_q: string) => ({ matches: false });

// RED until the coder creates termbar + the two-axis theme API.
import { mountTermbar } from "../src/components/termbar/termbar.ts";
import { getMode, setMode } from "../src/theme/theme.ts";

const docEl = shim.documentElement;
const newHost = () => new FakeElement("div") as unknown as HTMLElement;

beforeEach(() => {
  store.map.clear();
  delete docEl.dataset["theme"];
  delete docEl.dataset["mode"];
  setMode("dark");
});

/** Collect every class token across the mounted subtree (root + descendants). */
function allClasses(root: FakeElement): string[] {
  const out: string[] = [];
  const walk = (n: FakeElement): void => {
    out.push(...n.className.split(/\s+/).filter(Boolean));
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}

test("AC-17: mountTermbar returns a MountHandle whose el is .amu-termbar", () => {
  const host = newHost();
  const handle = mountTermbar(host, { cwd: "~/amenan-ui" });
  assert.ok(handle, "mountTermbar returns a handle");
  const el = handle.el as unknown as FakeElement;
  assert.ok(el.classList.contains("amu-termbar"), "the root carries .amu-termbar");
  assert.equal(typeof handle.destroy, "function", "handle exposes destroy()");
});

test("AC-17: renders the strip — dots + wordmark + cwd + status + toggle", () => {
  const host = newHost();
  const handle = mountTermbar(host, { cwd: "~/rbac-explorer", status: "● client-side" });
  const root = handle.el as unknown as FakeElement;
  const classes = new Set(allClasses(root));

  // traffic-light dots
  assert.ok([...classes].some((c) => /amu-termbar-dot\b/.test(c)), "renders traffic-light dot(s)");
  // wordmark — the literal "doumouya" text is allowed (not scrubbed)
  const text = collectText(root);
  assert.ok(text.includes("doumouya"), "renders the doumouya wordmark");
  // cwd appears
  assert.ok(text.includes("~/rbac-explorer"), "renders the injected cwd");
  // status pill text
  assert.ok(text.includes("client-side"), "renders the status pill");
  // a toggle control exists (a button-like .amu-termbar-* child)
  assert.ok(
    root.querySelector(".amu-termbar-toggle") || root.querySelector("button"),
    "renders the light/dark toggle control",
  );
});

test("AC-17: the toggle invokes theme.ts toggleMode() (flips getMode)", () => {
  const host = newHost();
  const handle = mountTermbar(host, { cwd: "~/x" });
  const root = handle.el as unknown as FakeElement;

  assert.equal(getMode(), "dark", "starts dark");
  const toggle =
    (root.querySelector(".amu-termbar-toggle") as unknown as FakeElement | null) ??
    (root.querySelector("button") as unknown as FakeElement | null);
  assert.ok(toggle, "found the toggle control");
  toggle!.dispatchEvent("click");
  assert.equal(getMode(), "light", "clicking the toggle flipped mode dark → light via toggleMode()");
  toggle!.dispatchEvent("click");
  assert.equal(getMode(), "dark", "a second click flips back to dark");
});

test("AC-17: scrub-clean — no .dc-/.rp- class or dc-theme anywhere in the markup", () => {
  const host = newHost();
  const handle = mountTermbar(host, { cwd: "~/x", status: "● client-side" });
  const root = handle.el as unknown as FakeElement;
  for (const c of allClasses(root)) {
    assert.ok(!c.startsWith("dc-"), `no .dc- class may survive, found ${c}`);
    assert.ok(!c.startsWith("rp-"), `no .rp- class may survive, found ${c}`);
  }
  // dc-theme must not appear in any attribute value either.
  const attrsDump = JSON.stringify(dumpAttrs(root));
  assert.ok(!attrsDump.includes("dc-theme"), "no dc-theme storage key/attr survives");
});

// ── small DOM-walk helpers ──────────────────────────────────────────────────
function collectText(root: FakeElement): string {
  let s = "";
  const walk = (n: FakeElement): void => {
    if (n.textContent) s += " " + n.textContent;
    for (const c of n.children) walk(c);
  };
  walk(root);
  return s;
}

function dumpAttrs(root: FakeElement): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const walk = (n: FakeElement): void => {
    out.push({ ...n.attributes });
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}
