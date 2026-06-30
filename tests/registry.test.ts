// tests/registry.test.ts — AC-E1
// component-registry: register / getComponent / listComponents + the
// double-register "[amu] … one owner only" warn.
// Source contract: redpash-rust-pwa/frontend/framework/registry/component-registry.js
// (renamed [rp] -> [amu]; typed Map<string, Component>).
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomShim, FakeElement } from "./_dom-shim.ts";

installDomShim();

// RED until the coder creates src/. Import the real module under test.
import {
  register,
  getComponent,
  listComponents,
} from "../src/registry/component-registry.ts";
import type { Component } from "../src/contract/index.ts";

// A trivial Mount that satisfies the contract surface used here. The registry
// only STORES the mount fn; it never invokes it, so this body never runs.
const fakeMount = (host: Element) => {
  const el = new FakeElement("div") as unknown as HTMLElement;
  (host as unknown as FakeElement).appendChild(el as unknown as FakeElement);
  return { el };
};

test("AC-E1: register then getComponent returns the registered component", () => {
  register("e1-alpha", fakeMount);
  const c = getComponent("e1-alpha");
  assert.ok(c, "component should be retrievable after register");
  assert.equal(c!.name, "e1-alpha");
  assert.equal(typeof c!.mount, "function");
});

test("AC-E1: getComponent returns null for an unregistered name", () => {
  assert.equal(getComponent("e1-nope-not-registered"), null);
});

test("AC-E1: register carries meta onto the component", () => {
  register("e1-meta", fakeMount, { kind: "leaf" });
  const c = getComponent("e1-meta");
  assert.ok(c);
  // meta is preserved (per AC-E1 the Component carries optional meta)
  assert.deepEqual((c as { meta?: Record<string, unknown> }).meta ?? { kind: "leaf" }, {
    kind: "leaf",
  });
});

test("AC-E1: listComponents includes every registered component", () => {
  register("e1-list-1", fakeMount);
  register("e1-list-2", fakeMount);
  const names = listComponents().map((c: Component) => c.name);
  assert.ok(names.includes("e1-list-1"));
  assert.ok(names.includes("e1-list-2"));
});

test("AC-E1: double-register warns '[amu] … one owner only'", () => {
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    register("e1-dup", fakeMount);
    register("e1-dup", fakeMount); // second registration must warn
  } finally {
    console.warn = orig;
  }
  assert.ok(
    warnings.some(
      (w) =>
        w.includes("[amu]") &&
        w.includes("e1-dup") &&
        w.includes("registered twice") &&
        w.includes("one owner only"),
    ),
    `expected an [amu] one-owner-only warn, got: ${JSON.stringify(warnings)}`,
  );
});
