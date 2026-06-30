#!/usr/bin/env node
/* build.mjs (amenan-ui) — AC-J3. The release build, ported from RedPash's
   build-fe.mjs discipline onto esbuild + a flattened dist/tokens.css.

   It does, in order:
     1. flatten styles.css (@import tree, manifest order = cascade order) into
        dist/tokens.css — byte-faithful to the dev cascade;
     2. emit the .d.ts surface via `tsc -p tsconfig.build.json` → dist/types/;
     3. esbuild src/showcase.ts → dist/showcase.js and src/app.ts → dist/app.js
        (bundle, esm) — SKIPPED while those entries don't exist yet (W0–W6:
        they land in W6; this step auto-activates then);
     4. module-graph self-check — every static/dynamic import literal in a
        shipped bundle resolves (esbuild fails the build on an unresolved import,
        so a typo 404s the BUILD, not runtime).

   Zero runtime deps: esbuild + typescript are devDependencies only. */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DIST = join(ROOT, "dist");

/* ── 0. clean dist ────────────────────────────────────────────────────── */
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

/* ── 1. flatten the CSS manifest into one bundle ──────────────────────── */
const manifestPath = join(ROOT, "styles.css");
if (!existsSync(manifestPath)) {
  console.error("build: styles.css manifest not found");
  process.exit(1);
}
let bundle = "";
for (const line of readFileSync(manifestPath, "utf8").split("\n")) {
  const m = line.match(/^@import\s+(?:url\()?["']([^"']+)["']\)?;/);
  if (!m) continue; // comments / blank — the manifest is @imports only
  const sheet = resolve(ROOT, m[1]);
  if (!existsSync(sheet)) {
    console.error(`build: manifest imports a missing sheet: ${m[1]}`);
    process.exit(1);
  }
  bundle += `/* ── ${m[1]} ── */\n` + readFileSync(sheet, "utf8") + "\n";
}
writeFileSync(join(DIST, "tokens.css"), bundle);
console.log("build: flattened styles.css → dist/tokens.css");

/* ── 2. emit the .d.ts surface ────────────────────────────────────────── */
execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], {
  cwd: ROOT,
  stdio: "inherit",
});
console.log("build: emitted dist/types/ (tsc -p tsconfig.build.json)");

/* ── 3. esbuild the entry bundles (when they exist) ───────────────────── */
const entries = [
  { src: join(ROOT, "src", "showcase.ts"), out: join(DIST, "showcase.js") },
  { src: join(ROOT, "src", "app.ts"), out: join(DIST, "app.js") },
];
const present = entries.filter((e) => existsSync(e.src));
if (present.length === 0) {
  console.log("build: no showcase/app entry yet — bundling deferred to W6 (CSS + types only)");
} else {
  /* esbuild's bundler IS the module-graph self-check (step 4): an unresolved
     static or dynamic import literal aborts the build with a non-zero exit. */
  for (const e of present) {
    execFileSync(
      "npx",
      [
        "esbuild",
        e.src,
        "--bundle",
        "--format=esm",
        "--platform=browser",
        "--target=es2022",
        `--outfile=${e.out}`,
      ],
      { cwd: ROOT, stdio: "inherit" },
    );
    console.log(`build: bundled ${e.src} → ${e.out}`);
  }
}

console.log("build: OK");
