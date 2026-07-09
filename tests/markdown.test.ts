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

// ── GFM pipe tables (the docs-in-site addition) ────────────────────────────

test("a pipe table renders thead th from row 1 and tbody td rows", () => {
  const root = md("| a | b |\n|---|---|\n| 1 | `x` |\n| 2 | y |");
  const table = root.children[0]!;
  assert.equal(table.tagName, "TABLE");
  const [thead, tbody] = table.children;
  assert.equal(thead!.tagName, "THEAD");
  assert.equal(tbody!.tagName, "TBODY");
  assert.deepEqual(thead!.children[0]!.children.map((c) => c.tagName), ["TH", "TH"]);
  assert.equal(tbody!.children.length, 2);
  assert.ok(tbody!.children[0]!.children[1]!.children.some((c) => c.tagName === "CODE"), "cells flow through inline()");
});

test("alignment colons in the divider are accepted", () => {
  const root = md("| a | b |\n|:--|--:|\n| 1 | 2 |");
  assert.equal(root.children[0]!.tagName, "TABLE");
});

test("an escaped pipe stays a literal pipe inside its cell", () => {
  const root = md("| a |\n|---|\n| x \\| y |");
  const td = root.children[0]!.children[1]!.children[0]!.children[0]!;
  assert.equal(textOf(td), "x | y");
});

test("a pipe-framed run WITHOUT a divider is a paragraph, not a table", () => {
  const root = md("| just | prose |\n| more | prose |");
  assert.deepEqual(tags(root), ["P"]);
});

test("a table terminates a paragraph run", () => {
  const root = md("prose line\n| a | b |\n|---|---|\n| 1 | 2 |");
  assert.deepEqual(tags(root), ["P", "TABLE"]);
});

test("safety canary: an unsafe link scheme stays literal text inside a cell", () => {
  const root = md("| a |\n|---|\n| [x](javascript:alert(1)) |");
  const td = root.children[0]!.children[1]!.children[0]!.children[0]!;
  assert.ok(!td.children.some((c) => c.tagName === "A"), "no <a> for an unsafe scheme");
  assert.ok(textOf(td).includes("[x](javascript:alert(1))"));
});
