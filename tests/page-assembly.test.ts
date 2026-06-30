// tests/page-assembly.test.ts — AC-F1 / AC-F2 / AC-F3
// assemblePage(host, spec: PageSpec, ctx): composes regions FROM the spec:
//   - topbar mounts only if spec.topbar (injected mount)
//   - rail mounts only if spec.rail (literal groups + optional injected load)
//   - surface ALWAYS mounts
//   - section(key) returns the section host
//   - destroy() cascades to all mounted handles in REVERSE mount order;
//     a failing child destroy() must NOT block the cascade
//   - shell class is .amu-shell (assert NO .rp-shell)
// Source being rewritten: redpash-rust-pwa/frontend/framework/page-assembly/page-assembly.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomShim, FakeElement } from "./_dom-shim.ts";

installDomShim();

// RED until the coder creates src/. Import the real unit under test + contract.
import { assemblePage } from "../src/page-assembly.ts";
import type {
  PageSpec,
  SurfaceSpec,
  RailSpec,
  Mount,
  MountHandle,
  MountCtx,
} from "../src/contract/index.ts";

const newHost = () => new FakeElement("div") as unknown as HTMLElement;
const ctx: MountCtx = {};

// A mount that records its mount + destroy into a shared order log.
function recordingMount(tag: string, log: string[], opts?: { failDestroy?: boolean }): Mount {
  return (host: Element): MountHandle => {
    const el = new FakeElement(tag) as unknown as HTMLElement;
    (host as unknown as FakeElement).appendChild(el as unknown as FakeElement);
    log.push(`mount:${tag}`);
    return {
      el,
      destroy() {
        log.push(`destroy:${tag}`);
        if (opts?.failDestroy) throw new Error(`boom-${tag}`);
      },
    };
  };
}

function surfaceSpec(log: string[]): SurfaceSpec {
  const s: SurfaceSpec = {
    mount: recordingMount("surface", log),
    sections: [
      { key: "main" },
      { key: "aside" },
    ],
  };
  return s;
}

function railSpec(log: string[]): RailSpec {
  return {
    mount: recordingMount("rail", log),
    groups: [{ items: [{ id: "a", label: "A" }] }],
  };
}

test("AC-F1: surface always mounts; topbar/rail absent when not in spec", () => {
  const log: string[] = [];
  const spec: PageSpec = { surface: surfaceSpec(log) };
  const handle = assemblePage(newHost(), spec, ctx);
  assert.ok(log.includes("mount:surface"), "surface must always mount");
  assert.ok(!log.includes("mount:topbar"), "topbar must NOT mount without spec.topbar");
  assert.ok(!log.includes("mount:rail"), "rail must NOT mount without spec.rail");
  assert.ok(handle.surface, "handle exposes surface");
  assert.equal(handle.rail, undefined, "handle.rail undefined when no rail spec");
});

test("AC-F1: topbar mounts only when spec.topbar is provided", () => {
  const log: string[] = [];
  const spec: PageSpec = {
    topbar: { mount: recordingMount("topbar", log) },
    surface: surfaceSpec(log),
  };
  assemblePage(newHost(), spec, ctx);
  assert.ok(log.includes("mount:topbar"), "topbar must mount when injected");
  assert.ok(log.includes("mount:surface"));
});

test("AC-F1: rail mounts only when spec.rail is provided", () => {
  const log: string[] = [];
  const spec: PageSpec = { rail: railSpec(log), surface: surfaceSpec(log) };
  const handle = assemblePage(newHost(), spec, ctx);
  assert.ok(log.includes("mount:rail"), "rail must mount when provided");
  assert.ok(handle.rail, "handle.rail present when rail spec given");
});

test("AC-F1: section(key) returns the section host element", () => {
  const log: string[] = [];
  const spec: PageSpec = { surface: surfaceSpec(log) };
  const handle = assemblePage(newHost(), spec, ctx);
  const main = handle.section("main");
  assert.ok(main, "section('main') returns a host");
  const aside = handle.section("aside");
  assert.ok(aside, "section('aside') returns a host");
  assert.notEqual(main, aside, "distinct section hosts per key");
});

test("AC-F2: shell class is .amu-shell, never .rp-shell", () => {
  const log: string[] = [];
  const host = newHost();
  assemblePage(host, { surface: surfaceSpec(log) }, ctx);
  const fake = host as unknown as FakeElement;
  assert.ok(fake.querySelector(".amu-shell"), "the assembled shell must carry .amu-shell");
  assert.equal(fake.querySelector(".rp-shell"), null, "no .rp-shell may survive");
});

test("AC-F3: destroy() cascades all handles in REVERSE mount order", () => {
  const log: string[] = [];
  const spec: PageSpec = {
    topbar: { mount: recordingMount("topbar", log) },
    rail: railSpec(log),
    surface: surfaceSpec(log),
  };
  const host = newHost();
  const handle = assemblePage(host, spec, ctx);

  // mount order recorded was topbar, rail, surface (region order).
  const destroysBefore = log.filter((l) => l.startsWith("destroy:"));
  assert.equal(destroysBefore.length, 0, "nothing destroyed before destroy()");

  handle.destroy();

  const destroyOrder = log.filter((l) => l.startsWith("destroy:"));
  const mountOrder = log.filter((l) => l.startsWith("mount:")).map((l) => l.split(":")[1]);
  const expectedReverse = [...mountOrder].reverse().map((t) => `destroy:${t}`);
  assert.deepEqual(
    destroyOrder,
    expectedReverse,
    "destroy must cascade in reverse mount order",
  );
});

test("AC-F3: a failing child destroy() does not block the cascade; shell removed", () => {
  const log: string[] = [];
  const spec: PageSpec = {
    topbar: { mount: recordingMount("topbar", log) },
    rail: railSpec(log),
    // surface destroy throws — the cascade must still reach the others.
    surface: { mount: recordingMount("surface", log, { failDestroy: true }), sections: [{ key: "main" }] },
  };
  const host = newHost();
  const handle = assemblePage(host, spec, ctx);

  assert.doesNotThrow(() => handle.destroy(), "a throwing child destroy must be swallowed");

  assert.ok(log.includes("destroy:surface"), "the failing child's destroy ran");
  assert.ok(log.includes("destroy:rail"), "rail destroy still ran after surface threw");
  assert.ok(log.includes("destroy:topbar"), "topbar destroy still ran after surface threw");

  const fake = host as unknown as FakeElement;
  assert.equal(fake.querySelector(".amu-shell"), null, "the shell is removed after destroy()");
});
