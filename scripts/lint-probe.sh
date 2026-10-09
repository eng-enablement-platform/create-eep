#!/usr/bin/env bash

# Regression test for `eslint.config.ts`, ported from eep-template-next-app.
# Each probe writes a tiny snippet to a sandboxed path, runs ESLint against
# it, and asserts whether the run passes or fails. Guards against:
#
#   1. A plugin gets dropped or its rule name changes after an upgrade.
#   2. A `files` / `ignores` glob stops matching what we think it matches.
#   3. Two config blocks fight over the same array-valued rule (the last
#      one wins in flat config - they do NOT merge).
#
# Run manually: `pnpm lint:probe`

set -uo pipefail

# Sandbox lives under `src/` so files are visible to the tsconfig and the
# typescript-eslint `projectService` doesn't reject them.
SANDBOX="src/__lint_probe__"

passed=0
failed=0
failures=()

cleanup() {
  rm -rf "$SANDBOX"
}
trap cleanup EXIT

# probe <description> <relative path under src/__lint_probe__> <pass|fail> <code> [rule]
# When [rule] is given, a "fail" probe only counts if that rule is the one
# that fired - so a probe can't pass by tripping some unrelated rule.
probe() {
  local description="$1"
  local rel_path="$2"
  local expected="$3"
  local code="$4"
  local rule="${5:-}"

  local file="$SANDBOX/$rel_path"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$code" > "$file"

  local output
  output=$(pnpm --silent eslint --max-warnings 0 "$file" 2>&1)
  local exit_code=$?

  local actual="pass"
  if [ $exit_code -ne 0 ]; then
    actual="fail"
    if [ -n "$rule" ] && ! grep -qF "$rule" <<< "$output"; then
      actual="fail (wrong rule, expected $rule)"
    fi
  fi

  if [ "$actual" = "$expected" ]; then
    printf '  \033[32m✓\033[0m %s\n' "$description"
    passed=$((passed + 1))
  else
    printf '  \033[31m✗\033[0m %s\n' "$description"
    printf '      expected=%s actual=%s\n' "$expected" "$actual"
    failures+=("$description")
    failures+=("$output")
    failed=$((failed + 1))
  fi
}

DOCUMENTED_DOUBLE=$'/**\n * Doubles a number.\n *\n * @param value - the input value\n * @returns the doubled value\n */\nexport function double(value: number): number {\n  return value * 2;\n}'

echo "Running ESLint config probes..."
echo ""

probe "baseline - documented named export passes" \
  "baseline.ts" "pass" \
  "$DOCUMENTED_DOUBLE"

probe "no-restricted-syntax - fails on export default" \
  "default-export.ts" "fail" \
  $'/**\n * Doubles a number.\n *\n * @param value - the input value\n * @returns the doubled value\n */\nexport default function double(value: number): number {\n  return value * 2;\n}' \
  "no-restricted-syntax"

probe "jsdoc/require-jsdoc - fails on undocumented export" \
  "undocumented.ts" "fail" \
  $'export function double(value: number): number {\n  return value * 2;\n}' \
  "jsdoc/require-jsdoc"

probe "tsdoc/syntax - fails on missing hyphen after @param name" \
  "bad-tsdoc.ts" "fail" \
  $'/**\n * Doubles a number.\n *\n * @param value the input value\n * @returns the doubled value\n */\nexport function double(value: number): number {\n  return value * 2;\n}' \
  "tsdoc/syntax"

probe "@stylistic/multiline-comment-style - fails on stacked // comments" \
  "stacked-comments.ts" "fail" \
  $'// line one\n// line two\n'"$DOCUMENTED_DOUBLE" \
  "@stylistic/multiline-comment-style"

probe "local/single-line-comment-style - fails on single-line block comment" \
  "block-comment.ts" "fail" \
  $'/* one line */\n'"$DOCUMENTED_DOUBLE" \
  "local/single-line-comment-style"

probe "consistent-type-imports - fails on value import used only as a type" \
  "type-import.ts" "fail" \
  $'import { Stats } from \'node:fs\';\n\n/**\n * Size of a file.\n *\n * @param stats - file stats\n * @returns the size in bytes\n */\nexport function size(stats: Stats): number {\n  return stats.size;\n}' \
  "@typescript-eslint/consistent-type-imports"

probe "simple-import-sort - fails on unsorted imports" \
  "unsorted.ts" "fail" \
  $'import path from \'node:path\';\nimport fs from \'node:fs\';\n\n/**\n * Joins and checks a path.\n *\n * @param name - file name\n * @returns whether it exists\n */\nexport function exists(name: string): boolean {\n  return fs.existsSync(path.join(\'.\', name));\n}' \
  "simple-import-sort/imports"

probe "strictTypeChecked - fails on floating promise" \
  "floating.ts" "fail" \
  $'/**\n * Kicks off work.\n *\n * @returns nothing\n */\nexport function run(): void {\n  Promise.resolve(1);\n}' \
  "@typescript-eslint/no-floating-promises"

echo ""
echo "Passed: $passed   Failed: $failed"

if [ $failed -gt 0 ]; then
  echo ""
  echo "Failure output:"
  echo ""
  printf '%s\n' "${failures[@]}"
  exit 1
fi
