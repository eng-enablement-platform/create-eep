# create-eep

Scaffold new projects from Engineering Enablement Platform (EEP) templates.

> **Under development.** This version is a placeholder to reserve the package name - it does nothing yet.

```bash
npm create eep@latest my-app
```

## Development

Requires Node 24 (see `.nvmrc`) and pnpm (version pinned in `package.json` - Corepack or pnpm itself will switch to it automatically).

The pre-commit hook also needs [gitleaks](https://github.com/gitleaks/gitleaks) (secret scanning) and [Trivy](https://trivy.dev) (dependency vulnerabilities):

```bash
brew install gitleaks trivy
```

```bash
pnpm install
```

`pnpm install` also sets up the Husky pre-commit hook. On every commit it scans staged files for secrets, runs Trivy when dependencies change, lints and formats staged files, and - when code changes - runs typecheck, tests and the build. For a WIP or TDD-red commit, skip the typecheck/tests/build step (secret scanning and linting still run):

```bash
SKIP_CHECKS=1 git commit -m "wip: ..."
```

| Command              | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `pnpm dev`           | Run the CLI from source (`node src/index.ts` - no build step needed) |
| `pnpm test`          | Run the test suite once                                              |
| `pnpm test:watch`    | Re-run tests on file changes                                         |
| `pnpm test:coverage` | Run tests with a coverage report (HTML report in `coverage/`)        |
| `pnpm typecheck`     | Type-check with `tsc` (no output emitted)                            |
| `pnpm lint`          | Lint with ESLint (fails on any warning)                              |
| `pnpm lint:fix`      | Lint and auto-fix what can be fixed                                  |
| `pnpm lint:probe`    | Check the ESLint config still enforces each rule                     |
| `pnpm format`        | Format all files with Prettier                                       |
| `pnpm format:check`  | Check formatting without writing changes                             |
| `pnpm build`         | Bundle the CLI into `dist/index.mjs` with tsdown                     |
| `pnpm lint:package`  | Check the package is publishable (`bin`, `files`, ...) with publint  |
| `pnpm smoke`         | Build, pack, install the tarball into a temp project and run it      |

Open the coverage report after `pnpm test:coverage`:

```bash
open coverage/index.html
```
