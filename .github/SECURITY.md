# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately, not as a public issue.

Use GitHub's private vulnerability reporting: open the [Security tab](https://github.com/eng-enablement-platform/create-eep/security) and select **Report a vulnerability**.
We will acknowledge the report, investigate, and keep you updated on the fix.

## Supported versions

Only the latest published version of `create-eep` receives fixes.
Run it with `npm create eep@latest` to make sure you have it.

## How releases are protected

- Releases are published from GitHub Actions via npm trusted publishing (OIDC) - there is no long-lived npm token to leak.
- Every release carries an npm provenance attestation linking it to the exact commit and workflow that built it.
- Dependencies are bundled into the published package, scanned with Trivy in CI, and kept up to date by Renovate.
