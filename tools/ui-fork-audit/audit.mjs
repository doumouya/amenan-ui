#!/usr/bin/env node
/* ui-fork-audit (amenan-ui) — the MECHANICAL single-CSS-ownership guarantee.
   Ported from redpash-rust-pwa/tools/ui-fork-audit/audit.js, adapted to
   amenan-ui's manifest model (`.amu-*` classes + a single styles.css @import
   manifest) and amenan-ui paths. The apps-only rules R1/R2/R7/R8/R9 are
   DROPPED (there is no apps tree). Exit code = violation count.

   Rules:
     R3  no !important in any .css
     R4  each .amu-<name> class owned by exactly ONE src sheet
         (over src/components/** *.css + src/page-assembly*.css)
     R5  no #id selectors (allow #app / #showcase only in the root/showcase
         sheet: styles.css or src/showcase.css)
     R6  styles.css manifest integrity: it is the ONLY file with @import; every
         component .css under src/ imported exactly once; tokens precede the
         component sheets in the manifest.

   Robust on an EMPTY/partial src/: when nothing is there yet it reports 0. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SRC = path.join(ROOT, "src");
const SKIP_DIRS = new Set(["vendor", "dist", "node_modules", ".git"]);
const violations = [];

function flag(file, line, rule, msg) {
  violations.push({ file: path.relative(ROOT, file), line, rule, msg });
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), exts, out);
    } else if (exts.some((e) => ent.name.endsWith(e))) {
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
}

/* ── CSS tokenizer: yields {selector, line} at any nesting depth ── */
function cssRules(text) {
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const rules = [];
  let buf = "";
  let line = 1;
  let selLine = 1;
  for (let i = 0; i < noComments.length; i++) {
    const ch = noComments[i];
    if (ch === "\n") line++;
    if (ch === "{") {
      const sel = buf.trim();
      if (sel && !sel.startsWith("@")) rules.push({ selector: sel, line: selLine });
      buf = "";
      selLine = line;
    } else if (ch === "}") {
      buf = "";
      selLine = line;
    } else {
      if (buf === "") selLine = line;
      buf += ch;
    }
  }
  return rules;
}

// All .css under src/ (component sheets, theme tokens, page-assembly shell, etc.)
const srcCss = walk(SRC, [".css"]);
// The manifest + the root/showcase sheet live at the repo root (styles.css) or
// alongside the showcase entry. We allow #app/#showcase only in these.
const manifest = path.join(ROOT, "styles.css");
const showcaseSheets = [
  manifest,
  path.join(SRC, "showcase.css"),
  path.join(ROOT, "showcase.css"),
];
const isRootOrShowcase = (f) => showcaseSheets.includes(f);

// component sheets for R4 ownership: src/components/** + the page-assembly shell.
const ownershipCss = srcCss.filter(
  (f) =>
    f.includes(`${path.sep}components${path.sep}`) ||
    path.basename(f).startsWith("page-assembly"),
);

// theme/token sheets are excluded from R4 class-ownership (they define :root vars,
// not .amu-* component classes) but still subject to R3 / R5.
const allCssForR3R5 = [...srcCss];
if (fs.existsSync(manifest)) allCssForR3R5.push(manifest);

const classOwner = new Map();

for (const f of allCssForR3R5) {
  const text = fs.readFileSync(f, "utf8");

  // R3 — no !important
  text.split("\n").forEach((l, i) => {
    if (l.includes("!important")) flag(f, i + 1, "R3", "!important");
  });

  for (const { selector, line } of cssRules(text)) {
    for (const sel of selector.split(",").map((s) => s.trim()).filter(Boolean)) {
      // R5 — #id selectors (allow #app / #showcase only in the root/showcase sheet)
      const idMatch = sel.match(/#[a-zA-Z][\w-]*/g) ?? [];
      for (const id of idMatch) {
        const allowed = isRootOrShowcase(f) && (id === "#app" || id === "#showcase");
        if (!allowed) flag(f, line, "R5", `#id selector: ${id}`);
      }
    }
  }
}

// R4 — each .amu-* class owned by exactly one component/page-assembly sheet
for (const f of ownershipCss) {
  const text = fs.readFileSync(f, "utf8");
  for (const { selector, line } of cssRules(text)) {
    for (const sel of selector.split(",").map((s) => s.trim()).filter(Boolean)) {
      for (const cls of sel.match(/\.amu-[\w-]+/g) ?? []) {
        if (!classOwner.has(cls)) classOwner.set(cls, f);
        else if (classOwner.get(cls) !== f) {
          flag(f, line, "R4", `${cls} also styled in ${path.relative(ROOT, classOwner.get(cls))}`);
        }
      }
    }
  }
}

/* R6 — manifest integrity (only enforced once styles.css exists) */
if (fs.existsSync(manifest)) {
  const text = fs.readFileSync(manifest, "utf8");
  const imports = [...text.matchAll(/@import\s+(?:url\()?["']([^"']+)["']\)?/g)].map((m) => m[1]);
  const resolved = imports.map((p) => path.resolve(path.dirname(manifest), p));

  // every src css (except the manifest itself) imported exactly once
  for (const f of srcCss) {
    if (f === manifest) continue;
    const n = resolved.filter((r) => r === f).length;
    if (n !== 1) flag(f, 0, "R6", `imported ${n}× by styles.css (must be exactly 1)`);
  }

  // ordering: tokens/theme imports precede the first component import
  const tokenIdx = resolved
    .map((r, i) => (r.includes(`${path.sep}theme${path.sep}`) || /tokens\.css$/.test(r) ? i : -1))
    .filter((i) => i >= 0);
  const compIdx = resolved
    .map((r, i) => (r.includes(`${path.sep}components${path.sep}`) ? i : -1))
    .filter((i) => i >= 0);
  if (tokenIdx.length && compIdx.length && Math.max(...tokenIdx) > Math.min(...compIdx)) {
    flag(manifest, 0, "R6", "a tokens/theme import follows a component import (tokens must come first)");
  }

  // @import nowhere else (styles.css is the only manifest)
  for (const f of srcCss) {
    if (f === manifest) continue;
    fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => {
      if (/@import/.test(l)) flag(f, i + 1, "R6", "@import outside styles.css");
    });
  }
}

/* ── report ── */
if (violations.length) {
  console.error(`ui-fork-audit: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}:${v.line} — ${v.msg}`);
  }
} else {
  console.log("ui-fork-audit: OK — no forks, no overrides, one owner per .amu- class");
}
process.exit(violations.length);
