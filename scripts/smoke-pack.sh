#!/usr/bin/env bash

# End-to-end check of the published artifact, exactly as a user gets it:
# build, pack the tarball npm would publish, install it into an empty project
# with npm, then run the `create-eep` bin. Catches what unit tests can't -
# a wrong `bin` path, `dist/` missing from `files`, a lost shebang, or a
# runtime import that was left external instead of bundled.
#
# Run manually: `pnpm smoke`

set -euo pipefail

WORK_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "📦 Building and packing..."
pnpm --silent build > /dev/null
pnpm pack --pack-destination "$WORK_DIR" > /dev/null
TARBALL="$(ls "$WORK_DIR"/create-eep-*.tgz)"

# Drop the npm_config_* variables pnpm exports to its scripts, so npm behaves
# as it would on a user's machine.
while IFS= read -r variable; do
  unset "$variable"
done < <(env | grep -io '^npm_config_[a-z0-9_]*')

echo "📥 Installing $(basename "$TARBALL") into an empty project..."
cd "$WORK_DIR"
npm init -y > /dev/null
npm install --no-audit --no-fund --silent "$TARBALL"

echo "🚀 Running create-eep..."
# Assert on the bin's stdout only - npm's own notices (on stderr) also mention
# "create-eep" and would make the check pass even if the bin printed nothing.
if ! OUTPUT="$(npx --no-install create-eep 2> "$WORK_DIR/stderr.log")"; then
  echo "❌ The installed bin exited non-zero:"
  cat "$WORK_DIR/stderr.log"
  exit 1
fi
echo "$OUTPUT"

if ! grep -q "create-eep" <<< "$OUTPUT"; then
  echo "❌ Unexpected output from the installed bin."
  exit 1
fi

echo "✅ Packed package installs and runs."
