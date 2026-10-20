import { describe, expect, it, vi } from 'vitest';

import { findLatestRelease, githubWebUrl } from '../latest-release.ts';

// A fetch that answers every request with the given status and Location.
const fakeFetch = (status: number, location?: string) =>
  vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(null, {
        status,
        headers: location === undefined ? {} : { location },
      }),
    ),
  );

const find = (fetchImpl: typeof fetch, githubApiUrl?: string) =>
  findLatestRelease('org/repo', { fetch: fetchImpl, githubApiUrl });

describe(findLatestRelease, () => {
  it('reads the tag from the /releases/latest redirect', async () => {
    const fetchImpl = fakeFetch(
      302,
      'https://github.com/org/repo/releases/tag/v1.2.0',
    );
    expect(await find(fetchImpl)).toBe('v1.2.0');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://github.com/org/repo/releases/latest',
      { method: 'HEAD', redirect: 'manual' },
    );
  });

  it('decodes an encoded tag', async () => {
    expect(
      await find(
        fakeFetch(
          302,
          'https://github.com/org/repo/releases/tag/repo%2Fv2.0.0',
        ),
      ),
    ).toBe('repo/v2.0.0');
  });

  it('keeps a tag containing a slash', async () => {
    expect(
      await find(
        fakeFetch(302, 'https://github.com/org/repo/releases/tag/repo/v2.0.0'),
      ),
    ).toBe('repo/v2.0.0');
  });

  it('finds no release when GitHub redirects to the releases list', async () => {
    expect(
      await find(fakeFetch(302, 'https://github.com/org/repo/releases')),
    ).toBeUndefined();
  });

  it.each([404, 500])('finds no release on a %i', async (status) => {
    expect(await find(fakeFetch(status))).toBeUndefined();
  });

  it('ignores a tag that is unsafe as a ref', async () => {
    expect(
      await find(
        fakeFetch(302, 'https://github.com/org/repo/releases/tag/-oops'),
      ),
    ).toBeUndefined();
  });

  it('lets network errors through so the caller can stop', async () => {
    const offline = vi.fn<typeof fetch>(() =>
      Promise.reject(new TypeError('fetch failed')),
    );
    await expect(find(offline)).rejects.toThrow('fetch failed');
  });

  it('asks the website that matches GIGET_GITHUB_URL', async () => {
    const fetchImpl = fakeFetch(302, '/org/repo/releases/tag/v1.0.0');
    expect(await find(fetchImpl, 'http://127.0.0.1:8080/')).toBe('v1.0.0');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/org/repo/releases/latest',
      expect.anything(),
    );
  });
});

describe(githubWebUrl, () => {
  it.each([
    [undefined, 'https://github.com'],
    ['', 'https://github.com'],
    ['https://api.github.com', 'https://github.com'],
    ['http://127.0.0.1:8080/', 'http://127.0.0.1:8080'],
  ])('maps %j to %s', (apiUrl, webUrl) => {
    expect(githubWebUrl(apiUrl)).toBe(webUrl);
  });
});
