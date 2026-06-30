#!/usr/bin/env node
/* scrub.mjs (amenan-ui) — AC-J2 / AC-L2. The identity-clean gate.
   Forbids any surviving RedPash identity across src/** and the docs files:
     /\bredpash\b | (^|[^-])\brp- | --rp- | data-rp- | dc-theme | new-dark | new-light/i
   Vendored static assets under vendor/ are OUT of scope (AC-A7). Exit code =
   total hit count (0 = clean). Robust on an empty/partial src/ (0 hits). */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "src");
const SKIP_DIRS = new Set(["vendor", "dist", "node_modules", ".git"]);
const DOCS = ["README.md", "THEME.md", "DISCIPLINE.md", "DEPENDENCY-MAP.md"];

// The forbidden pattern (per AC-J2). Global + case-insensitive for counting.
const PATTERN = /\bredpash\b|(^|[^-])\brp-|--rp-|data-rp-|dc-theme|new-dark|new-light/i;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), out);
    } else {
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
}

const files = [...walk(SRC)];
for (const d of DOCS) {
  const f = path.join(ROOT, d);
  if (fs.existsSync(f)) files.push(f);
}

const hits = [];
for (const f of files) {
  // binary-ish files are skipped silently; we only scrub text sources/docs
  let text;
  try {
    text = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (PATTERN.test(line)) {
      hits.push({ file: path.relative(ROOT, f), line: i + 1, text: line.trim().slice(0, 120) });
    }
  });
}

if (hits.length) {
  console.error(`scrub: ${hits.length} forbidden RedPash-identity hit(s)\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line} — ${h.text}`);
} else {
  console.log("scrub: OK — no RedPash identity in src/ or docs");
}
process.exit(hits.length);
