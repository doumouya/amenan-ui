// tests/perm-cell-cap.test.ts — AC-18 (the perm-cell `cap` ceiling + lock).
//
// EXTENDS coverage of the existing src/components/perm-cell/perm-cell.ts (a NEW
// file — does NOT touch/replace the existing perm-cell suite). Asserts the widened
// PermCellCfg `cap?: string`:
//   - cap:"r" ceils cycling at "r" — clicking past it wraps to the floor, never
//     reaches "rw"
//   - cap:"" (the empty tier) is a permanently-locked guardrail: data-locked="1",
//     click is a no-op, value stays the floor
//   - default (no cap) cycles the FULL order (regression that cap is opt-in)
//
// RED now: today's PermCellCfg has NO `cap` field and mountPermCell ignores any
// ceiling — so (a) passing `cap` is a tsc error (the widened PermCellCfg AC-18
// requires), and (b) at runtime cap:"r"/cap:"" are not honored, so the clamp +
// lock assertions fail. The coder MERGES `cap` into the existing factory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomShim, FakeElement } from "./_dom-shim.ts";

installDomShim();

// RED until the coder widens PermCellCfg with `cap` and honors it.
import { mountPermCell } from "../src/components/perm-cell/perm-cell.ts";

const newHost = () => new FakeElement("div") as unknown as HTMLElement;

/** Click the cell N times, returning the observed onChange values in order. */
function clickN(btn: FakeElement, n: number): void {
  for (let i = 0; i < n; i++) btn.dispatchEvent("click");
}

test("AC-18: cap:'r' ceils cycling at 'r' — 'rw' is never reachable", () => {
  const seen: string[] = [];
  const handle = mountPermCell(newHost(), { value: "", cap: "r", onChange: (v) => seen.push(v) });
  const btn = handle.el as unknown as FakeElement;

  // order ["", "r", "rw"], cap "r" → reachable span is ["", "r"].
  clickN(btn, 1);
  assert.equal(btn.dataset["perm"], "r", "first click → r");
  clickN(btn, 1);
  // capped: from "r" the next step wraps to the floor "", NOT up to "rw".
  assert.equal(btn.dataset["perm"], "none", "second click wraps to the floor (empty tier), not rw");
  clickN(btn, 1);
  assert.equal(btn.dataset["perm"], "r", "cycle stays within [\"\", \"r\"]");

  assert.ok(!seen.includes("rw"), `cap:'r' must never surface 'rw'; saw ${JSON.stringify(seen)}`);
});

test("AC-18: cap:'' is a permanently-locked guardrail (data-locked, no-op click)", () => {
  let changes = 0;
  const handle = mountPermCell(newHost(), { value: "", cap: "", onChange: () => changes++ });
  const btn = handle.el as unknown as FakeElement;

  assert.equal(btn.dataset["locked"], "1", "cap:'' stamps data-locked=\"1\"");
  clickN(btn, 3);
  assert.equal(btn.dataset["perm"], "none", "a locked cell never leaves the empty tier");
  assert.equal(changes, 0, "a locked cell's click is a no-op (onChange never fires)");
});

test("AC-18: a value above the cap is clamped down to the ceiling on mount", () => {
  // value "rw" but cap "r" → the cell must clamp the initial paint to "r".
  const handle = mountPermCell(newHost(), { value: "rw", cap: "r" });
  const btn = handle.el as unknown as FakeElement;
  assert.equal(btn.dataset["perm"], "r", "an over-cap initial value clamps to the ceiling");
});

test("AC-18: no cap (default) cycles the FULL order — rw IS reachable", () => {
  const seen: string[] = [];
  const handle = mountPermCell(newHost(), { value: "", onChange: (v) => seen.push(v) });
  const btn = handle.el as unknown as FakeElement;

  clickN(btn, 1);
  assert.equal(btn.dataset["perm"], "r");
  clickN(btn, 1);
  assert.equal(btn.dataset["perm"], "rw", "without a cap, rw is reachable");
  clickN(btn, 1);
  assert.equal(btn.dataset["perm"], "none", "the full order wraps none → r → rw → none");
  // and it is NOT locked.
  assert.notEqual(btn.dataset["locked"], "1", "an uncapped cell is not locked");
});
