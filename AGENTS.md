# AGENTS instructions

Rules only.
This is how we work - follow it.
Adapted from eep-template-next-app for a published Node CLI.

## Philosophy

Clean, coherent, simple.
Boring beats clever - if it's hard to read it's wrong.
Move fast but stay maintainable.
This CLI is the front door to every EEP template, so a confusing error message is a bug.

## Code Standards

- DRY, readable, boring - no clever solutions
- Error handling and edge cases are first-class, not afterthoughts
- Relative imports with explicit `.ts` extensions (`./utils.ts`) - required for running TypeScript natively with `node src/index.ts`
- `import type` for type-only imports - never mix types and values
- Named exports everywhere - default exports only where a tool's config loader requires it (`*.config.ts`)
- Functions are declarations for exported units; arrow functions for callbacks and small helpers
- `type` by default; `interface` only for declaration merging or `extends`
- Only erasable TypeScript syntax - no `enum`, `namespace` or constructor parameter properties (enforced by `erasableSyntaxOnly`)
- No arbitrary dependencies - check native Node APIs first; every runtime dependency is bundled into what we publish
- Comment the _why_, not the _what_ - only for non-obvious code
- `//` for single-line comments, starred `/* */` blocks for multi-line (lint enforced); `/** */` TSDoc only directly above the symbol it documents
- TSDoc on all exported functions in `.ts` files (lint enforced)
- Disabling a lint rule requires a comment saying why

## Dependencies

- Runtime packages go in `devDependencies` - tsdown bundles them into `dist/index.mjs`, so the published package has zero dependencies and `npx create-eep` starts fast
- pnpm enforces a 24h minimum release age - do not add `minimumReleaseAge` exclusions; pick a version that has been out for a day
- Trivy must scan with `--include-dev-deps`, otherwise the bundled runtime code is never scanned

## Git

- Branch: `<type>/<ticket>-<desc>` - `feat/`, `fix/`, `docs/`, `chore/` (ad-hoc `fix/<desc>`, no ticket)
- Conventional commits: `feat:` `fix:` `refactor:` `chore:` `docs:` `test:` `ci:` `BREAKING CHANGE:`
- Agents never commit or push on a developer's behalf unless explicitly asked to in that request. Leave changes uncommitted for review; "get it up", "set it up" or similar is not permission

## Git Hooks

- **Pre-commit** (`.husky/pre-commit`) is the first line of defence: gitleaks, actionlint (on `.github/` changes), shellcheck (on shell script changes), Trivy (on dependency changes), lint probes (on ESLint config changes), lint-staged, and on code changes typecheck + tests + build + publint
- The hook runs under `sh -e`, not bash - keep it POSIX (`pnpm lint:shell` checks this)
- **Escape hatch** `SKIP_CHECKS=1 git commit` - WIP/TDD-red only; secret scanning, linting and the other checks still run. Never to bypass failing tests on shippable code
- **CI** (`.github/workflows/ci.yml`) re-runs everything, plus the packed-tarball smoke test on the lowest supported Node and a full-history secret scan

## Testing

Test behaviour, not output formatting.
Filter: if you can break it by changing a branch, a flag's effect, or a file-system outcome - test that.

- **Pure logic** (arg parsing, URL normalising, template lookup) - always test
- **Side effects** (downloads, file writes, running install commands) - inject the dependency and test the decision, not the network
- **The published artifact** - covered by `pnpm smoke`, not unit tests
- TDD for small isolated units with a clear contract; not for exploratory integration work
- Co-locate tests in a `__tests__/` subfolder next to the code (`src/cli/__tests__/parse-args.test.ts`)
- Console output is the CLI's interface - `console-fail-test` fails any test that logs unexpectedly, so spy on or inject the logger

## Architecture

- **`src/index.ts`** - the `bin` entry. Thin: wire up and call into `src/cli/`. No logic
- **`src/cli/`** - argument parsing, prompts, output formatting
- **`src/templates/`** - the template registry and lookup
- **`src/scaffold/`** - download, post-download setup, package manager detection
- **`src/utils/`** - small shared helpers
- **`scripts/`** - repo tooling (lint probes, smoke test), never imported by `src/`
- **`eslint-rules/`** - local ESLint rules, each with a `RuleTester` test

## Naming

- **Folders and files** - kebab-case
- **index.ts** - only for a meaningful grouping/domain; never to wrap a single file
- **Utility modules** - single file until ~200 lines or ~3 concerns, then split into kebab-named files
- **Variables** - full descriptive names, never abbreviated

## Types

Scope sets the home; size can override to a file:

- Single-consumer -> inline (unless ~3+ types, one large type, or drowning the logic -> sibling `types.ts`)
- Shared by siblings -> `types.ts` at the feature boundary
- Shared across features -> `src/types.ts`

## Documentation

- TSDoc on exported code - lean, the _why_ not the _what_
- Functions: purpose, `@param`, `@returns` (enforced), one `@example` where it helps
- User-facing behaviour changes update the README in the same PR
- Never use em dashes - use a plain dash

## Quick Reference

| Concern        | Location                 | Convention                                            |
| -------------- | ------------------------ | ----------------------------------------------------- |
| CLI entry      | `src/index.ts`           | Thin, no logic                                        |
| Arg parsing/UX | `src/cli/`               | Tested pure functions, injected I/O                   |
| Templates      | `src/templates/`         | Registry + lookup                                     |
| Scaffolding    | `src/scaffold/`          | Side effects behind injectable functions              |
| Tests          | `**/__tests__/*.test.ts` | Vitest, co-located                                    |
| Build          | `tsdown.config.ts`       | Single bundled ESM file, Node 22.13+                  |
| Repo tooling   | `scripts/`               | Bash, shellcheck clean                                |
| CI / release   | `.github/workflows/`     | Actions pinned by SHA (third party), actionlint clean |
