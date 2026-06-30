// tests/theme-contract.test.ts — AC-7 (theme-contract test) + AC-13 (the FROZEN
// token-contract superset). Parses each shipped theme CSS under
// src/theme/themes/ and asserts EVERY contract token (AC-13) is assigned a
// non-empty value for BOTH modes (dark + light); also asserts _template.css
// lists every contract token name (as blank slots) so the add-a-theme recipe
// stays complete.
//
// RED now: src/theme/themes/{redpash,portfolio,numu,_template}.css do not exist
// yet (the platform split hasn't been built), so the fs.readFileSync calls throw
// → every assertion is unreachable → the suite fails.
//
// This is a FILESYSTEM/text test (no DOM, no import of src) — it reads the CSS as
// data and checks the declared custom properties. It deliberately does NOT import
// any not-yet-built module, so the only reason it is red is the missing files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = join(__dirname, "..", "src", "theme", "themes");

// ── AC-13: the FROZEN token-contract superset (the exact stable public schema
// every registered theme MUST fill). This is the PALETTE tier (per theme × mode)
// only — the STRUCTURE tier (--sp-*, --radius*, --text-*, --font-mono, density,
// motion, --bp-*) lives in base.css and is asserted by AC-1/AC-3, not here. ──

// (a) today's amenan palette names (tokens.css:61-107). `--font` is the
// per-theme display/body family (moved into the palette tier per AC-13/risk #5).
const TODAY_PALETTE = [
  "--bg",
  "--surface",
  "--surface-2",
  "--border",
  "--text",
  "--text-dim",
  "--text-mute",
  "--accent",
  "--accent-soft",
  "--on-accent",
  "--ok",
  "--warn",
  "--info",
  "--danger",
  "--hover",
  "--glass",
  "--glass-blur",
  "--shadow",
  "--ring",
  "--font",
] as const;

// (b) the NEW Console vocabulary added to the contract by AC-13.
const NEW_CONSOLE = [
  "--signal",
  "--signal-hover",
  "--signal-tint",
  "--rule",
  "--rule-shadow",
  "--focus-ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
  "--status-backlog",
  "--status-progress",
  "--status-review",
  "--status-done",
  "--shadow-popover",
  "--shadow-dialog",
] as const;

// The full FROZEN superset — every theme fills ALL of these, ×2 modes.
const CONTRACT_TOKENS: readonly string[] = [...TODAY_PALETTE, ...NEW_CONSOLE];

// The shipped themes the contract test verifies (excludes _template.css).
const SHIPPED_THEMES = ["redpash", "portfolio", "numu"] as const;

/** Read a theme file, or fail the test with a clear missing-file message
    (this is the RED signal until the coder creates the platform split). */
function readTheme(name: string): string {
  return readFileSync(join(THEMES_DIR, `${name}.css`), "utf8");
}

/** A custom property is "assigned a non-empty value" if it appears as
    `--name: <something-non-blank> ;` somewhere in `block`. Matches `var(...)`,
    `color-mix(...)`, hex, rgba, keywords — anything that isn't whitespace or an
    empty/TODO-only declaration. Captures up to the terminating `;`. */
function assignedNonEmpty(block: string, token: string): boolean {
  // Escape the token for the regex (only `-` is special-free, but be safe).
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${esc}\\s*:\\s*([^;]*);`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const raw = (m[1] ?? "").trim();
    // strip an inline /* … */ comment from the value (e.g. `var(--ok) /* x */`)
    const cleaned = raw.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (cleaned.length > 0) return true;
  }
  return false;
}

/** Slice the CSS to the rule body whose selector contains BOTH the theme name
    and the mode, e.g. `html[data-theme="portfolio"][data-mode="dark"] { … }`.
    Returns "" when no such block exists (→ assertions fail with a useful name). */
function modeBlock(css: string, theme: string, mode: "dark" | "light"): string {
  // Find a selector mentioning the theme and the mode, then take its { … } body.
  // Tolerant of attribute-quote style and whitespace; for the `:root` default
  // (redpash+dark) the coder may key dark off `:root` — but AC-4 requires the
  // explicit two-axis blocks to exist for every theme, so we require them here.
  const sel = new RegExp(
    `data-theme\\s*=\\s*["']?${theme}["']?[^{]*data-mode\\s*=\\s*["']?${mode}["']?[^{]*\\{([\\s\\S]*?)\\}`,
    "i",
  );
  const m = sel.exec(css);
  return m ? (m[1] ?? "") : "";
}

for (const theme of SHIPPED_THEMES) {
  for (const mode of ["dark", "light"] as const) {
    test(`AC-7/AC-13: ${theme}.css fills EVERY contract token for ${mode} mode`, () => {
      const css = readTheme(theme);
      const block = modeBlock(css, theme, mode);
      assert.notEqual(
        block,
        "",
        `${theme}.css must define a [data-theme="${theme}"][data-mode="${mode}"] block`,
      );
      const missing = CONTRACT_TOKENS.filter((tok) => !assignedNonEmpty(block, tok));
      assert.deepEqual(
        missing,
        [],
        `${theme}.css (${mode}) leaves these contract tokens unfilled: ${missing.join(", ")}`,
      );
    });
  }
}

test("AC-7: _template.css lists EVERY contract token name (as blank slots)", () => {
  const tpl = readTheme("_template");
  // The template is the add-a-theme starting point: every contract token name
  // must APPEAR (value may be blank / `/* TODO */`), grouped by family, so the
  // recipe stays complete. We assert NAME presence, NOT a non-empty value.
  const missing = CONTRACT_TOKENS.filter((tok) => {
    const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`${esc}\\s*:`).test(tpl);
  });
  assert.deepEqual(
    missing,
    [],
    `_template.css is missing these contract token slots: ${missing.join(", ")}`,
  );
});

test("AC-13: the contract superset is the today-palette ∪ new-Console set (frozen size)", () => {
  // Guards the frozen schema: 20 palette + 20 Console = 40 names, no dupes. If a
  // future change adds a name without a spec revision, this count breaks — the
  // AC-13 "FROZEN by this AC" guarantee made executable.
  assert.equal(TODAY_PALETTE.length, 20, "today's palette tier is 20 names");
  assert.equal(NEW_CONSOLE.length, 20, "the new Console vocabulary is 20 names");
  assert.equal(
    new Set(CONTRACT_TOKENS).size,
    CONTRACT_TOKENS.length,
    "no duplicate token name in the contract superset",
  );
});
