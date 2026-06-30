// tests/responsive.test.ts — AC-19 (the responsive kernel lands at
// src/kernel/responsive.ts, ported from web-kit's responsive.ts).
//
// Imports the REAL src/kernel/responsive.ts and asserts the ported surface:
//   device() / breakpoint() / isTouch() / isShort() / isFolded() / onChange()
//   + the BREAKPOINTS table + the Device/Breakpoint types (type-level via tsc).
// matchMedia + innerWidth/innerHeight are mocked so the matchMedia-driven
// signals are deterministic (adapted from web-kit's responsive.test.mjs).
//
// RED now: src/kernel/responsive.ts does not exist yet (AC-19 not implemented)
// → the import resolves to nothing → suite fails.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── matchMedia + viewport mock ──────────────────────────────────────────────
// A single mutable "world" the mocked matchMedia answers against. Each test sets
// the touch/short/fold flags + the width/height it wants, then calls the unit.
interface World {
  coarse: boolean; // (pointer: coarse)
  noHover: boolean; // (hover: none)
  short: boolean; // (max-height: 480px)
  folded: boolean; // (*-viewport-segments: 2)
  width: number;
  height: number;
}
const world: World = { coarse: false, noHover: false, short: false, folded: false, width: 1280, height: 800 };

function installEnv(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g["matchMedia"] = (q: string): { matches: boolean } => {
    if (q.includes("pointer: coarse")) return { matches: world.coarse };
    if (q.includes("hover: none")) return { matches: world.noHover };
    if (q.includes("max-height: 480px")) return { matches: world.short };
    if (q.includes("viewport-segments: 2")) return { matches: world.folded };
    return { matches: false };
  };
  // device()/breakpoint() read globalThis.innerWidth/innerHeight.
  Object.defineProperty(g, "innerWidth", { configurable: true, get: () => world.width });
  Object.defineProperty(g, "innerHeight", { configurable: true, get: () => world.height });
  // onChange wires addEventListener/removeEventListener/requestAnimationFrame.
  g["addEventListener"] = g["addEventListener"] ?? (() => {});
  g["removeEventListener"] = g["removeEventListener"] ?? (() => {});
  g["requestAnimationFrame"] = (cb: () => void): number => {
    cb();
    return 1;
  };
  g["cancelAnimationFrame"] = () => {};
}
installEnv();

beforeEach(() => {
  world.coarse = false;
  world.noHover = false;
  world.short = false;
  world.folded = false;
  world.width = 1280;
  world.height = 800;
});

// RED until the coder creates src/kernel/responsive.ts.
import {
  BREAKPOINTS,
  breakpoint,
  device,
  isTouch,
  isShort,
  isFolded,
  onChange,
} from "../src/kernel/responsive.ts";

test("AC-19: BREAKPOINTS carries the documented px thresholds", () => {
  // The numeric px values are the JS source of truth (web-kit responsive.ts:15-22).
  assert.equal(BREAKPOINTS.xs, 360);
  assert.equal(BREAKPOINTS.sm, 480);
  assert.equal(BREAKPOINTS.md, 600);
  assert.equal(BREAKPOINTS.lg, 768);
  assert.equal(BREAKPOINTS.xl, 1024);
  assert.equal(BREAKPOINTS["2xl"], 1280);
});

test("AC-19: breakpoint(width) names the width band", () => {
  assert.equal(breakpoint(0), "base", "below xs → base");
  assert.equal(breakpoint(360), "xs");
  assert.equal(breakpoint(480), "sm");
  assert.equal(breakpoint(600), "md");
  assert.equal(breakpoint(768), "lg");
  assert.equal(breakpoint(1024), "xl");
  assert.equal(breakpoint(1280), "2xl");
  assert.equal(breakpoint(1920), "2xl", "above 2xl stays 2xl");
});

test("AC-19: isTouch() is true on a coarse pointer OR no-hover device", () => {
  world.coarse = false;
  world.noHover = false;
  assert.equal(isTouch(), false, "fine pointer + hover → not touch");
  world.coarse = true;
  assert.equal(isTouch(), true, "coarse pointer → touch");
  world.coarse = false;
  world.noHover = true;
  assert.equal(isTouch(), true, "no hover → touch");
});

test("AC-19: isShort() reflects the max-height:480px query", () => {
  world.short = false;
  assert.equal(isShort(), false);
  world.short = true;
  assert.equal(isShort(), true);
});

test("AC-19: isFolded() reflects the viewport-segments query", () => {
  world.folded = false;
  assert.equal(isFolded(), false);
  world.folded = true;
  assert.equal(isFolded(), true);
});

test("AC-19: device() — fine pointer is desktop regardless of width", () => {
  world.coarse = false;
  world.noHover = false;
  world.width = 360;
  world.height = 640;
  assert.equal(device(), "desktop", "a narrow window with a fine pointer is still desktop");
});

test("AC-19: device() — a touch device with a short side < md is a phone", () => {
  world.coarse = true;
  // landscape phone: wide but short (short side 400 < md 600)
  world.width = 900;
  world.height = 400;
  assert.equal(device(), "phone", "wide-but-short touch device → phone");
});

test("AC-19: device() — a touch device with a short side >= md is a tablet", () => {
  world.coarse = true;
  world.width = 1024;
  world.height = 768; // short side 768 >= md 600
  assert.equal(device(), "tablet");
});

test("AC-19: onChange(cb) returns a cleanup function and fires cb on resize", () => {
  // Capture the registered handlers so the test can drive a resize.
  const handlers: Array<() => void> = [];
  const g = globalThis as unknown as Record<string, unknown>;
  const prevAdd = g["addEventListener"];
  const prevRemove = g["removeEventListener"];
  let removed = 0;
  g["addEventListener"] = (type: string, fn: () => void): void => {
    if (type === "resize" || type === "orientationchange") handlers.push(fn);
  };
  g["removeEventListener"] = (): void => {
    removed++;
  };
  try {
    let fired = 0;
    const cleanup = onChange(() => fired++);
    assert.equal(typeof cleanup, "function", "onChange returns a cleanup function");
    assert.ok(handlers.length >= 1, "onChange registered a resize/orientation handler");
    handlers[0]!(); // simulate a resize → debounced rAF (mocked to run sync) → cb
    assert.equal(fired, 1, "the resize handler invoked the callback");
    cleanup();
    assert.ok(removed >= 1, "cleanup removed the listener(s)");
  } finally {
    g["addEventListener"] = prevAdd;
    g["removeEventListener"] = prevRemove;
  }
});
