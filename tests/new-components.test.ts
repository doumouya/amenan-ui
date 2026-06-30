// tests/new-components.test.ts — AC-20 (tabs / code / kindLabel ported to amenan).
//
// Imports the REAL src/components/{tabs,code,kindLabel}/<name>.ts and asserts each
// mounts via the amenan mount→MountHandle factory and renders its renamed .amu-*
// markup (.amu-tabs* / .amu-code* / .amu-kind*), preserving the web-kit feature
// surface:
//   - tabs: underline + segmented variants, controlled/uncontrolled value + onChange
//   - code: inline/block + tone/truncate
//   - kindLabel: Int/Float/Bool/Text × text/chip
// Scrub: no .dc-* survives.
//
// RED now: none of src/components/{tabs,code,kindLabel} exist yet (AC-20 not built)
// → the imports resolve to nothing → suite fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomShim, FakeElement } from "./_dom-shim.ts";

installDomShim();

// RED until the coder ports the three components to amenan conventions.
import { mountTabs } from "../src/components/tabs/tabs.ts";
import { mountCode } from "../src/components/code/code.ts";
import { mountKindLabel } from "../src/components/kindLabel/kindLabel.ts";

const newHost = () => new FakeElement("div") as unknown as HTMLElement;

function allClasses(root: FakeElement): string[] {
  const out: string[] = [];
  const walk = (n: FakeElement): void => {
    out.push(...n.className.split(/\s+/).filter(Boolean));
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}
const noDcClass = (root: FakeElement): boolean => allClasses(root).every((c) => !c.startsWith("dc-"));

// ── tabs ────────────────────────────────────────────────────────────────────
test("AC-20: mountTabs renders .amu-tabs with a tab per item", () => {
  const handle = mountTabs(newHost(), {
    items: [
      { id: "list", label: "List" },
      { id: "board", label: "Board" },
    ],
  });
  const root = handle.el as unknown as FakeElement;
  assert.ok(root.classList.contains("amu-tabs"), "root carries .amu-tabs");
  const tabs = root.querySelectorAll(".amu-tabs-tab");
  assert.equal(tabs.length, 2, "renders one .amu-tabs-tab per item");
  assert.ok(noDcClass(root), "no .dc- class survives in tabs markup");
});

test("AC-20: mountTabs supports the segmented variant + controlled value/onChange", () => {
  let picked = "";
  const handle = mountTabs(newHost(), {
    variant: "segmented",
    value: "list",
    items: [
      { id: "list", label: "List" },
      { id: "board", label: "Board" },
    ],
    onChange: (id: string) => {
      picked = id;
    },
  });
  const root = handle.el as unknown as FakeElement;
  assert.ok(
    allClasses(root).some((c) => c === "amu-tabs--segmented"),
    "segmented variant applies .amu-tabs--segmented",
  );
  // the active tab reflects the controlled value
  const tabs = root.querySelectorAll(".amu-tabs-tab");
  const active = tabs.find((t) => t.getAttribute("aria-selected") === "true");
  assert.ok(active, "the controlled value selects a tab");
  // clicking the other tab calls onChange with its id
  const other = tabs.find((t) => t.getAttribute("aria-selected") !== "true");
  other!.dispatchEvent("click");
  assert.equal(picked, "board", "clicking a tab fires onChange with its id");
});

// ── code ────────────────────────────────────────────────────────────────────
test("AC-20: mountCode renders inline .amu-code and a block variant", () => {
  const inline = mountCode(newHost(), { text: "GET /api" });
  const ir = inline.el as unknown as FakeElement;
  assert.ok(ir.classList.contains("amu-code"), "inline carries .amu-code");
  assert.ok(
    allClasses(ir).some((c) => c === "amu-code--inline"),
    "inline applies .amu-code--inline",
  );

  const block = mountCode(newHost(), { text: "line1\nline2", block: true });
  const br = block.el as unknown as FakeElement;
  assert.ok(
    allClasses(br).some((c) => c === "amu-code--block"),
    "block applies .amu-code--block",
  );
  assert.ok(noDcClass(ir) && noDcClass(br), "no .dc- class survives in code markup");
});

test("AC-20: mountCode honors tone + truncate modifiers", () => {
  const accent = mountCode(newHost(), { text: "x", tone: "accent" });
  assert.ok(
    allClasses(accent.el as unknown as FakeElement).some((c) => c === "amu-code--accent"),
    "tone:'accent' applies .amu-code--accent",
  );
  const trunc = mountCode(newHost(), { text: "x", truncate: true });
  assert.ok(
    allClasses(trunc.el as unknown as FakeElement).some((c) => c === "amu-code--truncate"),
    "truncate:true applies .amu-code--truncate",
  );
});

// ── kindLabel ─────────────────────────────────────────────────────────────────
test("AC-20: mountKindLabel renders .amu-kind for each kind (text variant)", () => {
  for (const kind of ["Int", "Float", "Bool", "Text"] as const) {
    const handle = mountKindLabel(newHost(), { kind });
    const root = handle.el as unknown as FakeElement;
    assert.ok(root.classList.contains("amu-kind"), `${kind} carries .amu-kind`);
    const text = root.textContent || collectText(root);
    assert.ok(text.includes(kind), `${kind} label renders its kind text`);
    assert.ok(noDcClass(root), "no .dc- class survives in kindLabel markup");
  }
});

test("AC-20: mountKindLabel chip variant applies the per-kind chip class", () => {
  const handle = mountKindLabel(newHost(), { kind: "Int", variant: "chip" });
  const root = handle.el as unknown as FakeElement;
  const classes = allClasses(root);
  assert.ok(classes.some((c) => c === "amu-kind--chip"), "chip variant applies .amu-kind--chip");
  assert.ok(classes.some((c) => c === "amu-kind--int"), "Int chip applies the per-kind .amu-kind--int");
});

function collectText(root: FakeElement): string {
  let s = "";
  const walk = (n: FakeElement): void => {
    if (n.textContent) s += " " + n.textContent;
    for (const c of n.children) walk(c);
  };
  walk(root);
  return s;
}
