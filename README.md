# create-eep

[![CI](https://github.com/eng-enablement-platform/create-eep/actions/workflows/ci.yml/badge.svg)](https://github.com/eng-enablement-platform/create-eep/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/create-eep)](https://www.npmjs.com/package/create-eep)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Scaffold new projects from Engineering Enablement Platform (EEP) templates.

> **Early days.** Templates are copied as-is for now - interactive prompts, template clean-up and dependency install are coming.

## Usage

With `npx`:

```bash
npx create-eep@latest my-app --template next
```

Or with `npm create` (pass options after `--` so npm forwards them):

```bash
npm create eep@latest my-app -- --template next
```

Note the hyphen with `npx` - it's `create-eep`, not `create eep`.

Works with any package manager (`pnpm create eep my-app --template next`, `yarn create eep ...`, `bunx create-eep ...`).
Requires Node 22.13 or later.

### Templates

| Name   | Template                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `web`  | [Web dev starter](https://github.com/eng-enablement-platform/eep-template-web-dev-starter) - plain HTML, CSS and JavaScript (default) |
| `next` | [Next.js full-stack app](https://github.com/eng-enablement-platform/eep-template-next-app)                                            |

Any public GitHub repo also works as a template:

```bash
npm create eep@latest my-app -- --template https://github.com/org/repo
```

### Options

| Option                         | Description                                                     |
| ------------------------------ | --------------------------------------------------------------- |
| `-t, --template <name-or-url>` | Template name, GitHub repo URL or `gh:org/repo` (default `web`) |
| `-v, --version`                | Print the version                                               |
| `-h, --help`                   | Show help, including the template list                          |

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

| Command               | What it does                                                                   |
| --------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`            | Run the CLI from source, e.g. `pnpm dev my-app --template web` (no build step) |
| `pnpm test`           | Run the test suite once                                                        |
| `pnpm test:watch`     | Re-run tests on file changes                                                   |
| `pnpm test:coverage`  | Run tests with a coverage report (HTML report in `coverage/`)                  |
| `pnpm typecheck`      | Type-check with `tsc` (no output emitted)                                      |
| `pnpm lint`           | Lint with ESLint (fails on any warning)                                        |
| `pnpm lint:fix`       | Lint and auto-fix what can be fixed                                            |
| `pnpm lint:probe`     | Check the ESLint config still enforces each rule                               |
| `pnpm lint:workflows` | Lint GitHub Actions workflows with actionlint (+ shellcheck on `run:` steps)   |
| `pnpm lint:shell`     | Lint the pre-commit hook and `scripts/*.sh` with shellcheck                    |
| `pnpm format`         | Format all files with Prettier                                                 |
| `pnpm format:check`   | Check formatting without writing changes                                       |
| `pnpm build`          | Bundle the CLI into `dist/index.mjs` with tsdown                               |
| `pnpm lint:package`   | Check the package is publishable (`bin`, `files`, ...) with publint            |
| `pnpm smoke`          | Build, pack, install the tarball into a temp project and run it                |

Check workflow YAML locally before pushing - catches typos, broken `${{ }}` expressions, bad `needs:` references and shell bugs in `run:` steps without waiting for a CI run:

```bash
pnpm lint:workflows
```

Open the coverage report after `pnpm test:coverage`:

```bash
open coverage/index.html
```

## Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please) - never bump the version or edit `CHANGELOG.md` by hand.

1. Commit to `main` with [conventional commits](https://www.conventionalcommits.org/) - `fix:` means a patch release, `feat:` a minor one (`docs:`, `chore:`, `ci:` and `test:` don't trigger a release).
2. release-please keeps a single **Release PR** open with the next version and changelog, updating it on every push.
3. Merge the Release PR to release: it tags the commit, creates a GitHub Release, and the `publish` job publishes to npm via OIDC trusted publishing (with provenance).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Agents (and humans) should also follow [AGENTS.md](AGENTS.md).

Found a security issue? Please report it privately - see [SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE)
