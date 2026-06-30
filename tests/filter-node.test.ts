// tests/filter-node.test.ts — AC-H2 (filter-node algebra)
// The PURE FilterNode <-> rows logic ported as-is from
// redpash-rust-pwa/frontend/framework/filter-panel/filter-node.js.
// assembleFilter / decomposeFilter / evalFilter round-trip + predicate / list /
// range ops. No DOM. Assertions match the source contract exactly:
//   Group { node:"group", op:"and"|"or", children:[...] }   (empty = match-all)
//   Pred  { node:"pred", col, op, value?, case_sensitive? }
import { test } from "node:test";
import assert from "node:assert/strict";

// RED until the coder creates src/.
import {
  assembleFilter,
  decomposeFilter,
  evalFilter,
  isEmptyFilter,
} from "../src/components/filter-panel/filter-node.ts";

// ── assembleFilter ──────────────────────────────────────────────────────────

test("AC-H2: assembleFilter with no complete rows yields an empty match-all Group", () => {
  const node = assembleFilter([], "and");
  assert.deepEqual(node, { node: "group", op: "and", children: [] });
  assert.equal(isEmptyFilter(node), true, "empty group is the match-all filter");
});

test("AC-H2: assembleFilter coerces clean numbers; eq pred keeps string value", () => {
  const node = assembleFilter([{ col: "name", op: "eq", value: "amir" }], "and");
  assert.deepEqual(node, {
    node: "group",
    op: "and",
    children: [{ node: "pred", col: "name", op: "eq", value: "amir" }],
  });
});

test("AC-H2: assembleFilter — range op (between) -> two coerced bounds", () => {
  const node = assembleFilter([{ col: "age", op: "between", from: "18", to: "65" }], "and");
  assert.deepEqual(node.children, [
    { node: "pred", col: "age", op: "between", value: [18, 65] },
  ]);
});

test("AC-H2: assembleFilter — list op (in) -> trimmed, empty-stripped array", () => {
  const node = assembleFilter([{ col: "city", op: "in", value: " paris, lyon , , nice " }], "and");
  assert.deepEqual(node.children, [
    { node: "pred", col: "city", op: "in", value: ["paris", "lyon", "nice"] },
  ]);
});

test("AC-H2: assembleFilter — valueless ops (is_null/not_null) omit value", () => {
  const node = assembleFilter(
    [
      { col: "a", op: "is_null" },
      { col: "b", op: "not_null" },
    ],
    "or",
  );
  assert.deepEqual(node, {
    node: "group",
    op: "or",
    children: [
      { node: "pred", col: "a", op: "is_null" },
      { node: "pred", col: "b", op: "not_null" },
    ],
  });
});

test("AC-H2: assembleFilter — incomplete rows are skipped", () => {
  const node = assembleFilter(
    [
      { col: "", op: "eq", value: "x" }, // no col -> skipped
      { col: "k", op: "eq", value: "" }, // empty value -> skipped
      { col: "k", op: "eq", value: "v" }, // complete -> kept
    ],
    "and",
  );
  assert.equal(node.children.length, 1);
  assert.deepEqual(node.children[0], { node: "pred", col: "k", op: "eq", value: "v" });
});

test("AC-H2: assembleFilter — case_sensitive flag flows through when set", () => {
  const node = assembleFilter([{ col: "n", op: "contains", value: "Q", caseSensitive: true }], "and");
  assert.deepEqual(node.children[0], {
    node: "pred",
    col: "n",
    op: "contains",
    value: "Q",
    case_sensitive: true,
  });
});

// ── round-trip: decompose(assemble(rows)) ───────────────────────────────────

test("AC-H2: decomposeFilter round-trips a top-level assembled filter", () => {
  const rows = [
    { col: "name", op: "eq", value: "amir", from: "", to: "", caseSensitive: false },
    { col: "age", op: "between", from: "18", to: "65", value: "", caseSensitive: false },
    { col: "city", op: "in", value: "paris, lyon", from: "", to: "", caseSensitive: false },
  ];
  const node = assembleFilter(rows, "or");
  const { combinator, rows: back } = decomposeFilter(node);
  assert.equal(combinator, "or");
  // re-assembling the decomposed rows reproduces the same FilterNode
  assert.deepEqual(assembleFilter(back, combinator), node);
});

test("AC-H2: decomposeFilter on null / non-group yields one blank row, AND combinator", () => {
  const { combinator, rows } = decomposeFilter(null as unknown as never);
  assert.equal(combinator, "and");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.col, "");
});

// ── evalFilter (client-side row evaluation) ─────────────────────────────────

test("AC-H2: evalFilter — empty group / null node is match-all (true)", () => {
  assert.equal(evalFilter(null as unknown as never, { a: "1" }), true);
  assert.equal(evalFilter({ node: "group", op: "and", children: [] }, { a: "1" }), true);
});

test("AC-H2: evalFilter — eq / contains are case-insensitive by default", () => {
  const node = assembleFilter([{ col: "name", op: "contains", value: "AM" }], "and");
  assert.equal(evalFilter(node, { name: "amir" }), true);
  assert.equal(evalFilter(node, { name: "noor" }), false);
});

test("AC-H2: evalFilter — case_sensitive contains respects case", () => {
  const node = assembleFilter([{ col: "name", op: "contains", value: "AM", caseSensitive: true }], "and");
  assert.equal(evalFilter(node, { name: "amir" }), false, "uppercase AM not in lowercase amir");
  assert.equal(evalFilter(node, { name: "AMir" }), true);
});

test("AC-H2: evalFilter — numeric gt/lt coerce numbers", () => {
  const gt = assembleFilter([{ col: "n", op: "gt", value: "10" }], "and");
  assert.equal(evalFilter(gt, { n: "20" }), true);
  assert.equal(evalFilter(gt, { n: "5" }), false);
});

test("AC-H2: evalFilter — between (range) inclusive numeric bounds", () => {
  const node = assembleFilter([{ col: "age", op: "between", from: "18", to: "65" }], "and");
  assert.equal(evalFilter(node, { age: "40" }), true);
  assert.equal(evalFilter(node, { age: "17" }), false);
  assert.equal(evalFilter(node, { age: "65" }), true, "upper bound inclusive");
});

test("AC-H2: evalFilter — in (list) membership, case-insensitive default", () => {
  const node = assembleFilter([{ col: "city", op: "in", value: "Paris, Lyon" }], "and");
  assert.equal(evalFilter(node, { city: "paris" }), true);
  assert.equal(evalFilter(node, { city: "nice" }), false);
});

test("AC-H2: evalFilter — is_null / not_null on missing vs present cells", () => {
  const isNull = assembleFilter([{ col: "x", op: "is_null" }], "and");
  const notNull = assembleFilter([{ col: "x", op: "not_null" }], "and");
  assert.equal(evalFilter(isNull, { x: "" }), true);
  assert.equal(evalFilter(isNull, { x: "v" }), false);
  assert.equal(evalFilter(notNull, { x: "v" }), true);
  assert.equal(evalFilter(notNull, {}), false);
});

test("AC-H2: evalFilter — group op AND vs OR combine children", () => {
  const and = assembleFilter(
    [
      { col: "a", op: "eq", value: "1" },
      { col: "b", op: "eq", value: "2" },
    ],
    "and",
  );
  const or = assembleFilter(
    [
      { col: "a", op: "eq", value: "1" },
      { col: "b", op: "eq", value: "2" },
    ],
    "or",
  );
  assert.equal(evalFilter(and, { a: "1", b: "2" }), true);
  assert.equal(evalFilter(and, { a: "1", b: "9" }), false);
  assert.equal(evalFilter(or, { a: "1", b: "9" }), true);
  assert.equal(evalFilter(or, { a: "9", b: "9" }), false);
});
