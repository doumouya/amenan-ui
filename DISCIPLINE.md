# Discipline

amenan-ui keeps one CI-enforced invariant: **single CSS ownership**. Every
`.amu-<name>*` class is owned by exactly one component sheet, and there is one
`@import` manifest. The audit suite (`npm run audit`) enforces this mechanically;
the gate (`npm run ci`) chains it with typecheck, build, and tests.

## The audit rules (manifest model)

`tools/ui-fork-audit/audit.mjs` runs these over `src/**` `.css` + the manifest:

- **R3 — no `!important`.** No `.css` may use `!important`. Specificity, not
  overrides, decides the cascade.
- **R4 — one owner per `.amu-*` class.** Each `.amu-<name>*` class is styled in
  exactly one sheet (over `src/components/**/*.css` + the page-assembly shell
  sheet). Two sheets touching the same class is a fork — the single failure this
  rule exists to prevent.
- **R5 — no `#id` selectors.** Styling targets classes, not ids. `#app` /
  `#showcase` are allowed only in the root/showcase sheet.
- **R6 — manifest integrity.** `styles.css` is the ONLY file containing
  `@import`. Every component `.css` under `src/` is imported exactly once, and
  the token/theme sheet precedes every component sheet (manifest order =
  cascade order). The build flattens this tree byte-faithfully into
  `dist/tokens.css`.

The apps-rooting rules from the source framework are dropped — amenan-ui has no
apps tree.

## Single ownership

> **One component owns its `.amu-<name>*` namespace.**

A component's `.ts` and `.css` live together under `src/components/<name>/`. The
`.css` styles only that component's `.amu-<name>*` classes; another component that
wants the look composes the existing component, it does not restyle the class.
The page-assembly shell (`.amu-shell*`) is owned by `src/page-assembly.css`.

## The ratchet

`tools/ci-audit/check.sh` runs every `tools/*-audit/audit.mjs` plus the standalone
`tools/scrub.mjs`, then ratchets each tool's violation count against
`tools/ci-audit/baseline.json` (`{ "ui-fork": 0, "scrub": 0 }`). Any count above
its baseline fails CI. The scrub forbids any surviving foreign-framework
identity across `src/**` and the docs.

## The gate

`npm run ci` (`tools/ci.sh`) chains: **typecheck → audit → build → test**. The
final exit code is the count of failed stages (0 = clean). This is the one gate;
there is no second path.
