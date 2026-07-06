// tests/markdown.test.ts — renderMarkdown, focused on the HEADINGS addition (numu
// CAS_25dbaded: h1–h6 through the same safe inline() path) plus safety canaries so
// the ONE renderer's guarantees can't regress silently: unsafe link schemes stay
// literal text, and >6 hashes is a paragraph, not a heading.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomShim, FakeElement } from "./_dom-shim.ts";

installDomShim();

const { renderMarkdown } = await import("../src/components/markdown/markdown.ts");

const md = (s: string): FakeElement => renderMarkdown(s) as unknown as FakeElement;
const textOf = (n: FakeElement): string =>
  n.tagName === "#TEXT" ? n.textContent : n.children.map(textOf).join("");
const tags = (root: FakeElement): string[] => root.children.map((c) => c.tagName);

test("# through ###### render h1–h6 with the text intact", () => {
  const root = md("# One\n## Two\n###### Six");
  assert.deepEqual(tags(root), ["H1", "H2", "H6"]);
  assert.equal(textOf(root.children[0]!), "One");
  assert.equal(textOf(root.children[2]!), "Six");
});

test("heading text flows through inline() — bold inside a heading", () => {
  const root = md("## plan **B**");
  const h2 = root.children[0]!;
  assert.equal(h2.tagName, "H2");
  assert.ok(h2.children.some((c) => c.tagName === "STRONG"));
  assert.equal(textOf(h2), "plan B");
});

test("a heading terminates a paragraph run (BLOCK_LEAD)", () => {
  const root = md("prose line\n# Title");
  assert.deepEqual(tags(root), ["P", "H1"]);
});

test("seven hashes is NOT a heading — literal paragraph text", () => {
  const root = md("####### nope");
  assert.deepEqual(tags(root), ["P"]);
  assert.equal(textOf(root.children[0]!), "####### nope");
});

test("hashes without a following space stay literal (#hashtag)", () => {
  const root = md("#hashtag");
  assert.deepEqual(tags(root), ["P"]);
  assert.equal(textOf(root.children[0]!), "#hashtag");
});

test("safety canary: an unsafe link scheme stays literal text, even in a heading", () => {
  const root = md("# see [x](javascript:alert(1))");
  const h1 = root.children[0]!;
  assert.ok(!h1.children.some((c) => c.tagName === "A"), "no <a> for an unsafe scheme");
  assert.ok(textOf(h1).includes("[x](javascript:alert(1))"));
});

test("safety canary: a safe link still renders as <a> with the guard attrs", () => {
  const root = md("[docs](https://numu.im)");
  const a = root.children[0]!.children.find((c) => c.tagName === "A")!;
  assert.ok(a, "safe scheme renders an <a>");
  assert.equal(a.getAttribute("rel"), "noopener noreferrer");
  assert.equal(a.getAttribute("target"), "_blank");
});
