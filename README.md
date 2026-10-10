# create-eep

[![CI](https://github.com/eng-enablement-platform/create-eep/actions/workflows/ci.yml/badge.svg)](https://github.com/eng-enablement-platform/create-eep/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/create-eep)](https://www.npmjs.com/package/create-eep)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Scaffold new projects from Engineering Enablement Platform (EEP) templates.

> **Under development.** The CLI does not create projects yet - the foundations (build, tests, CI, publishing) are in place and the scaffolding comes next.

## Usage

```bash
npm create eep@latest my-app
```

Works with any package manager:

```bash
pnpm create eep my-app
```

Requires Node 22.13 or later.

## Development

Requires Node 24 (see `.nvmrc`) and pnpm (version pinned in `package.json` - Corepack or pnpm itself will switch to it automatically).

The pre-commit hook also needs [gitleaks](https://github.com/gitleaks/gitleaks) (secret scanning), [Trivy](https://trivy.dev) (dependency vulnerabilities), [actionlint](https://github.com/rhysd/actionlint) (GitHub Actions workflows) and [shellcheck](https://www.shellcheck.net) (shell scripts):

```bash
brew install gitleaks trivy actionlint shellcheck
```

```bash
pnpm install
```

`pnpm install` also sets up the Husky pre-commit hook. On every commit it scans staged files for secrets, runs Trivy when dependencies change, lints and formats staged files, and - when code changes - runs typecheck, tests and the build. For a WIP or TDD-red commit, skip the typecheck/tests/build step (secret scanning and linting still run):

```bash
SKIP_CHECKS=1 git commit -m "wip: ..."
```

| Command               | What it does                                                                 |
| --------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`            | Run the CLI from source (`node src/index.ts` - no build step needed)         |
| `pnpm test`           | Run the test suite once                                                      |
| `pnpm test:watch`     | Re-run tests on file changes                                                 |
| `pnpm test:coverage`  | Run tests with a coverage report (HTML report in `coverage/`)                |
| `pnpm typecheck`      | Type-check with `tsc` (no output emitted)                                    |
| `pnpm lint`           | Lint with ESLint (fails on any warning)                                      |
| `pnpm lint:fix`       | Lint and auto-fix what can be fixed                                          |
| `pnpm lint:probe`     | Check the ESLint config still enforces each rule                             |
| `pnpm lint:workflows` | Lint GitHub Actions workflows with actionlint (+ shellcheck on `run:` steps) |
| `pnpm lint:shell`     | Lint the pre-commit hook and `scripts/*.sh` with shellcheck                  |
| `pnpm format`         | Format all files with Prettier                                               |
| `pnpm format:check`   | Check formatting without writing changes                                     |
| `pnpm build`          | Bundle the CLI into `dist/index.mjs` with tsdown                             |
| `pnpm lint:package`   | Check the package is publishable (`bin`, `files`, ...) with publint          |
| `pnpm smoke`          | Build, pack, install the tarball into a temp project and run it              |

Check workflow YAML locally before pushing - catches typos, broken `${{ }}` expressions, bad `needs:` references and shell bugs in `run:` steps without waiting for a CI run:

```bash
pnpm lint:workflows
```

Open the coverage report after `pnpm test:coverage`:

```bash
open coverage/index.html
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Agents (and humans) should also follow [AGENTS.md](AGENTS.md).

Found a security issue? Please report it privately - see [SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE)
