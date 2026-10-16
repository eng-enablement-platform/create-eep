import { describe, expect, it } from 'vitest';

import { describeDownloadError } from '../download-errors.ts';

const target = {
  templateName: 'next-app',
  templateSource: 'gh:eng-enablement-platform/eep-template-next-app',
};
const withRef = {
  ...target,
  templateSource: 'gh:eng-enablement-platform/eep-template-next-app#feat/x',
  ref: 'feat/x',
};

// Shaped like giget's errors: "Failed to download <url>: <status> <text>".
const httpError = (status: string) =>
  new Error(
    `Failed to download https://api.github.com/repos/eng-enablement-platform/eep-template-next-app/tarball/main: ${status}`,
  );

// Shaped like Node's fetch failing to connect, wrapped by giget.
const networkError = (code: string) =>
  new Error('Failed to download https://api.github.com/...: TypeError', {
    cause: new TypeError('connect failed', {
      cause: Object.assign(new Error(code), { code }),
    }),
  });

describe(describeDownloadError, () => {
  it('names the missing --ref and links the template repository', () => {
    const message = describeDownloadError(httpError('404 Not Found'), withRef);
    expect(message).toContain(
      'Couldn\'t find "feat/x" in the next-app template',
    );
    expect(message).toContain(
      'https://github.com/eng-enablement-platform/eep-template-next-app',
    );
    expect(message).not.toContain('#feat/x');
  });

  it('suggests the latest create-eep when the template itself is missing', () => {
    const message = describeDownloadError(httpError('404 Not Found'), target);
    expect(message).toContain("The next-app template couldn't be found");
    expect(message).toContain('npx create-eep@latest');
  });

  it.each(['403 Forbidden', '429 Too Many Requests'])(
    'explains the rate limit and how to use a token on %s',
    (status) => {
      const message = describeDownloadError(httpError(status), target);
      expect(message).toContain("GitHub's download limit was reached");
      expect(message).toContain('GIGET_AUTH=$(gh auth token)');
    },
  );

  it('points at GIGET_AUTH when the token is rejected', () => {
    expect(
      describeDownloadError(httpError('401 Unauthorized'), target),
    ).toContain('GitHub rejected the token in GIGET_AUTH');
  });

  it('asks to retry when GitHub itself fails', () => {
    expect(
      describeDownloadError(httpError('502 Bad Gateway'), target),
    ).toContain(
      'GitHub had a problem (502 Bad Gateway). Try again in a minute.',
    );
  });

  it('says GitHub could not be reached when fetch fails outright', () => {
    const giget = new Error(
      'Failed to download https://api.github.com/...: TypeError: fetch failed',
    );
    expect(describeDownloadError(giget, target)).toContain(
      "Couldn't reach GitHub",
    );
  });

  it.each(['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'])(
    'recognises the %s network error deep in the cause chain',
    (code) => {
      expect(describeDownloadError(networkError(code), target)).toContain(
        "Couldn't reach GitHub",
      );
    },
  );

  it('keeps the original error as details', () => {
    expect(describeDownloadError(httpError('404 Not Found'), target)).toMatch(
      /\n\nDetails: Failed to download .*: 404 Not Found$/,
    );
  });

  it('falls back to the raw error when it is not recognised', () => {
    expect(describeDownloadError(new Error('Disk full'), target)).toBe(
      'Could not download template "gh:eng-enablement-platform/eep-template-next-app": Disk full',
    );
  });

  it('handles non-Error values', () => {
    expect(describeDownloadError('boom', target)).toContain(': boom');
  });
});
