#!/usr/bin/env node
/* ratchet.mjs (amenan-ui) — AC-J1. The file-based regression gate for
   tools/ci-audit/check.sh. Ported from redpash-rust-pwa/tools/ci-audit/
   ratchet.mjs, adapted for amenan-ui:
     - audits are `.mjs` (tools/*-audit/audit.mjs), discovered by existence
       (this is a fresh repo where files may be untracked early; no git gate);
     - the standalone tools/scrub.mjs is counted as its own "scrub" audit so
       the ratchet tracks it (AC-J2);
   Same exit-code contract:
     - exit 0 when every tool is at or below baseline (fixed/improved/unchanged);
     - exit 1 with a markdown table when any tool is ABOVE baseline (`new`/
       `regressed`);
     - mode `update` rewrites baseline.json from the current counts (exit 0).
   A tool's violation count is its process exit code (each audit exits with its
   count). */

import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const TOOLS = join(ROOT, "tools");
const BASELINE_PATH = join(HERE, "baseline.json");

const mode = process.argv[2] || "run"; // run | no-run | update

/* ── discover audits ──────────────────────────────────────────────────────
   - every tools/*-audit/audit.mjs  → tool = <name> (dir minus "-audit")
   - the standalone tools/scrub.mjs  → tool = "scrub" */
function discoverAudits() {
  const out = [];
  for (const ent of readdirSync(TOOLS, { withFileTypes: true })) {
    if (ent.isDirectory() && ent.name.endsWith("-audit")) {
      const audit = join(TOOLS, ent.name, "audit.mjs");
      if (existsSync(audit)) out.push({ tool: basename(ent.name, "-audit"), script: audit });
    }
  }
  const scrub = join(TOOLS, "scrub.mjs");
  if (existsSync(scrub)) out.push({ tool: "scrub", script: scrub });
  return out.sort((a, b) => a.tool.localeCompare(b.tool));
}

/* ── violation count for one tool = its process exit code ── */
function countFor({ script }) {
  try {
    execFileSync("node", [script], { stdio: "ignore" });
    return 0;
  } catch (e) {
    if (typeof e.status === "number") return e.status;
    throw e; // a real spawn failure, not a violation count
  }
}

const audits = discoverAudits();
const current = {};
for (const a of audits) current[a.tool] = countFor(a);

/* ── update mode ── */
if (mode === "update") {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n");
  console.log(`  ✓ baseline updated (${BASELINE_PATH}):`);
  for (const [t, c] of Object.entries(current)) console.log(`      ${t}: ${c}`);
  process.exit(0);
}

/* ── load baseline ── */
let baseline = {};
if (existsSync(BASELINE_PATH)) {
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.error("ci-audit: baseline.json is malformed — run --update-baseline.");
    process.exit(2);
  }
} else {
  console.error(
    "ci-audit: no baseline.json. Establish one with:\n" +
      "    sh tools/ci-audit/check.sh --update-baseline",
  );
  process.exit(2);
}

/* ── classify: regression = current > baseline, or no baseline entry ── */
const regressions = [];
for (const [tool, cur] of Object.entries(current)) {
  const prev = baseline[tool];
  if (prev === undefined) {
    if (cur > 0) regressions.push({ tool, status: "new", prev: "—", cur });
  } else if (cur > prev) {
    regressions.push({ tool, status: "regressed", prev, cur });
  }
}

if (regressions.length === 0) {
  console.log("  ✓ no new or regressed findings across audited tools.");
  process.exit(0);
}

console.log("  ✗ regressions detected — see the table below.\n");
console.log("## Audit regressions\n");
console.log(
  "Latest audit run vs the committed baseline (tools/ci-audit/baseline.json). " +
    "`regressed` = more violations than the baseline; `new` = a tool with " +
    "violations and no baseline entry yet. After an intentional change, accept " +
    "the new counts with `sh tools/ci-audit/check.sh --update-baseline`.\n",
);
console.log("| Tool | Status | Violations (baseline → current) |");
console.log("|---|---|---|");
for (const r of regressions) {
  console.log(`| ${r.tool} | ${r.status} | ${r.prev} → ${r.cur} |`);
}
console.log("\nDrill into each finding via the tool itself: node tools/<tool>-audit/audit.mjs");
process.exit(1);
