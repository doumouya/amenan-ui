#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────────────────────
# amenan-ui CI — AC-J4. The ordered gate `npm run ci` runs:
#     typecheck → audit (ui-fork + scrub via the ci-audit ratchet) → build → test
# Each stage runs even if an earlier one failed (so one run surfaces every
# problem); the final exit code is the count of FAILED stages (0 = clean).
# ─────────────────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

# resolve node for non-interactive shells (nvm)
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
fi

failures=0

stage() {
  name="$1"
  shift
  echo "════════════════════════  ci · $name  ════════════════════════"
  if "$@"; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name (exit $?)"
    failures=$((failures + 1))
  fi
  echo
}

stage "typecheck" npm run --silent typecheck
stage "audit"     sh tools/ci-audit/check.sh
stage "build"     npm run --silent build
stage "test"      npm run --silent test

echo "════════════════════════  ci · summary  ════════════════════════"
if [ "$failures" -eq 0 ]; then
  echo "  ✓ all stages green"
else
  echo "  ✗ $failures stage(s) failed"
fi
exit "$failures"
