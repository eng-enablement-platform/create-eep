# Contributing

Thanks for helping improve create-eep!
A few simple things for guidance.

## Getting set up

Follow the [Development](README.md#development) section of the README.
In short: Node 24 (`.nvmrc`), pnpm, and the pre-commit tools:

```bash
brew install gitleaks trivy actionlint shellcheck
```

```bash
pnpm install
```

## Branches

```
<type>/<issue-number>-<brief-description>

feat/EEP-123-template-prompt
fix/EEP-456-windows-paths
```

- `feat/` - new features
- `fix/` - bug fixes
- `docs/` - documentation-only changes
- `chore/` - tooling, dependencies, config
- Ad-hoc (no issue): `fix/<brief-description>` is fine for small isolated fixes

The branch prefix mirrors the [commit type](#commits).

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/).
Every message starts with one of:

```
feat:      new feature
fix:       bug fix
refactor:  neither fixes a bug nor adds a feature
chore:     tooling, dependencies, config
docs:      documentation only
test:      tests only
ci:        CI workflows
BREAKING CHANGE: incompatible change
```

Commit types drive releases: `feat:` and `fix:` end up in the changelog and decide the next version number, so pick them carefully.

## Pull requests

- **Fill out the PR template.** Describe the problem, the solution, how to verify, and any AI/agent assistance used.
- **Self-review before publishing.** Resolve conflicts, confirm CI is green, and check the change actually works - `pnpm smoke` runs the packed CLI exactly as `npx` would.
- **Keep it small and in scope.** Don't bundle unrelated work. For large changes, stack PRs rather than opening one giant diff.
- **Stay on it after it's up.** Once threads are resolved and approvals are in, merge promptly.

## Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please) - never bump the version or edit `CHANGELOG.md` by hand.

1. Commit to `main` with [conventional commits](https://www.conventionalcommits.org/) - `fix:` means a patch release, `feat:` a minor one (`docs:`, `chore:`, `ci:` and `test:` don't trigger a release).
2. release-please keeps a single **Release PR** open with the next version and changelog, updating it on every push.
3. Merge the Release PR to release: it tags the commit, creates a GitHub Release, and the `publish` job publishes to npm via OIDC trusted publishing (with provenance).

## Security

See [SECURITY.md](.github/SECURITY.md).
