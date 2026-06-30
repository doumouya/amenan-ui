#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────────────────────
# amenan-ui CI audit-diff check — AC-J1. The single-CSS-ownership + identity
# fidelity floor. Ported from redpash-rust-pwa/tools/ci-audit/check.sh.
#
# Auto-discovers every tools/*-audit/audit.mjs plus the standalone
# tools/scrub.mjs, runs each, then ratchets each tool's violation count against
# the committed baseline (tools/ci-audit/baseline.json). Exits 0 when nothing
# has regressed; exits 1 with a markdown table when any tool has MORE violations
# than its baseline. Tools at or below baseline pass.
#
# Usage:
#   sh tools/ci-audit/check.sh                    # run audits + ratchet
#   sh tools/ci-audit/check.sh --no-run           # ratchet only (re-runs to count)
#   sh tools/ci-audit/check.sh --update-baseline  # accept current counts as baseline
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"
HERE="tools/ci-audit"

# resolve node for non-interactive shells (nvm)
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ci-audit: node not found (needed to run the audit suite). Aborting."
  exit 2
fi

MODE="run"
case "${1:-}" in
  --no-run)          MODE="no-run" ;;
  --update-baseline) MODE="update" ;;
  "")                MODE="run" ;;
  *) echo "ci-audit: unknown arg '$1' (expected --no-run | --update-baseline)"; exit 2 ;;
esac

# ── 1. run the suite (auto-discovered audit.mjs per tools/*-audit/ + scrub) ──
if [ "$MODE" != "no-run" ]; then
  echo "════════════════════════  ci-audit · running suite  ════════════════════════"
  for audit in tools/*-audit/audit.mjs; do
    [ -f "$audit" ] || continue
    tool="$(basename "$(dirname "$audit")" -audit)"
    echo "────────  $tool  ────────"
    set +e
    node "$audit"
    set -e
    echo
  done
  if [ -f tools/scrub.mjs ]; then
    echo "────────  scrub  ────────"
    set +e
    node tools/scrub.mjs
    set -e
    echo
  fi
fi

# ── 2. ratchet violation counts against the committed baseline ──────────────
echo "════════════════════════  ci-audit · checking regressions  ════════════════════════"
node "$HERE/ratchet.mjs" "$MODE"
