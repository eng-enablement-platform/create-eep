<p align="center">
  <img src=".github/assets/eep-logo-full.svg" alt="EEP" width="360" />
</p>

<h1 align="center">create-eep</h1>

<p align="center">
  <a href="https://github.com/eng-enablement-platform/create-eep/actions/workflows/ci.yml">
    <img src="https://github.com/eng-enablement-platform/create-eep/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://www.npmjs.com/package/create-eep">
    <img src="https://img.shields.io/npm/v/create-eep" alt="npm" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" />
  </a>
</p>

<p align="center">Scaffold new projects from Engineering Enablement Platform (EEP) templates.</p>

## Usage

Run it with no arguments and it asks for a project name and template:

```bash
npx create-eep@latest
```

Or pass everything up front - with `npx`:

```bash
npx create-eep@latest my-app --template next-app
```

Or with `npm create` (pass options after `--` so npm forwards them):

```bash
npm create eep@latest my-app -- --template next-app
```

Note the hyphen with `npx` - it's `create-eep`, not `create eep`.

Works with any package manager (`pnpm create eep my-app --template next-app`, `yarn create eep ...`, `bunx create-eep ...`).
Requires Node 22.13 or later.

After downloading, create-eep asks which optional extras to keep, then gets the project ready to run: it initialises a git repository, installs dependencies with the template's package manager, and makes a first commit.
Without a terminal (CI, scripts, agents) or with `--yes`, it uses the defaults - everything on - so pass `--no-install` / `--no-git` to skip a step.
A failed install never deletes the project; the summary tells you what to run next.

### Templates

| Name              | Template                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `web-dev-starter` | [Web dev starter](https://github.com/eng-enablement-platform/eep-template-web-dev-starter) - plain HTML, CSS and JavaScript (default) |
| `next-app`        | [Next.js full-stack app](https://github.com/eng-enablement-platform/eep-template-next-app)                                            |

Each template is downloaded from its latest release (e.g. `v1.0.0`), or from `main` if it has no releases yet.
Use `--ref main` for the latest unreleased changes, or `--ref <tag>` to pin a version.

create-eep only scaffolds EEP templates. To copy any other GitHub repository (no history, no set-up), use [giget](https://github.com/unjs/giget): `npx giget gh:org/repo my-app`.

### Options

| Option                       | Description                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `-t, --template <name>`      | Template to use (default `web-dev-starter`)                                                         |
| `--ref <ref>`                | Use a branch, tag or commit instead of the latest release - e.g. `main`, or a template change       |
| `--with <extra>`             | Keep an optional extra the template offers, e.g. `docs` (repeatable)                                |
| `--without <extra>`          | Drop an optional extra the template offers (repeatable)                                             |
| `--install` / `--no-install` | Install dependencies (default yes) - uses the template's package manager (e.g. pnpm for `next-app`) |
| `--git` / `--no-git`         | Initialise a git repository with a first commit (default yes)                                       |
| `-y, --yes`                  | Skip prompts and use the defaults                                                                   |
| `-v, --version`              | Print the version                                                                                   |
| `-h, --help`                 | Show help, including the template list                                                              |

## For template authors

A template can include an `.eep/` folder that tells create-eep how to turn it into a project.
create-eep applies it after downloading and then deletes `.eep/`, so it never reaches generated projects.
Templates without one are copied as-is.

`.eep/template.json`:

```json
{
  "version": 3,
  "remove": ["path/only-needed-to-maintain-the-template/"],
  "readme": "README.md",
  "features": [
    {
      "id": "docs",
      "prompt": "Include the docs site?",
      "default": false,
      "remove": ["docs/"],
      "scripts": ["dev:docs", "build:docs"]
    },
    {
      "id": "diagrams",
      "prompt": "Include diagrams-as-code?",
      "default": true,
      "remove": ["diagrams/"],
      "setup": {
        "title": "Install diagram dependencies",
        "command": ["uv", "sync"],
        "cwd": "diagrams",
        "missing": "Diagrams need uv (it downloads Python for you) - see https://docs.astral.sh/uv/getting-started/installation/, then `cd diagrams && uv sync`."
      }
    }
  ]
}
```

- `remove` - paths always deleted from generated projects (must stay inside the project)
- `readme` - a starter README inside `.eep/` that replaces the template's own. `{{projectName}}` and `{{templateName}}` are filled in
- `features` (version 2+) - optional extras. In a terminal each `prompt` is asked as a yes/no question with `default` pre-selected; otherwise `--with <id>` / `--without <id>` decide, falling back to `default`. A dropped feature has its `remove` paths deleted and its `scripts` removed from `package.json`
- `setup` (version 3) - a command run for a kept feature, together with the dependency install (same question, same `--install` / `--no-install`). Runs without a shell in `cwd`. If `requires` (default: the command itself) isn't installed, `missing` is shown instead; if the install is skipped, the command is listed under next steps
- `package.json` `name` (if present) is set to the project name
- Version 1 and 2 manifests are still supported

If setup fails, the half-made project directory is removed.

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

| Command                 | What it does                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`              | Run the CLI from source, e.g. `pnpm dev my-app --template web-dev-starter` (no build step)   |
| `pnpm test`             | Run the test suite once                                                                      |
| `pnpm test:watch`       | Re-run tests on file changes                                                                 |
| `pnpm test:coverage`    | Run tests with a coverage report (HTML report in `coverage/`)                                |
| `pnpm test:integration` | Build, then run the built CLI against a local fake GitHub (download, release lookup, errors) |
| `pnpm typecheck`        | Type-check with `tsc` (no output emitted)                                                    |
| `pnpm lint`             | Lint with ESLint (fails on any warning)                                                      |
| `pnpm lint:fix`         | Lint and auto-fix what can be fixed                                                          |
| `pnpm lint:probe`       | Check the ESLint config still enforces each rule                                             |
| `pnpm lint:workflows`   | Lint GitHub Actions workflows with actionlint (+ shellcheck on `run:` steps)                 |
| `pnpm lint:shell`       | Lint the pre-commit hook and `scripts/*.sh` with shellcheck                                  |
| `pnpm format`           | Format all files with Prettier                                                               |
| `pnpm format:check`     | Check formatting without writing changes                                                     |
| `pnpm build`            | Bundle the CLI into `dist/index.mjs` with tsdown                                             |
| `pnpm lint:package`     | Check the package is publishable (`bin`, `files`, ...) with publint                          |
| `pnpm smoke`            | Build, pack, install the tarball into a temp project and run it                              |

Check workflow YAML locally before pushing - catches typos, broken `${{ }}` expressions, bad `needs:` references and shell bugs in `run:` steps without waiting for a CI run:

```bash
pnpm lint:workflows
```

Open the coverage report after `pnpm test:coverage`:

```bash
open coverage/index.html
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
