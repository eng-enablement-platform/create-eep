import { validateRef } from '../templates/registry.ts';

/** Finds a repository's latest release tag - `undefined` when it has none. */
export type FindLatestRelease = (
  repository: string,
) => Promise<string | undefined>;

type FindLatestReleaseOptions = {
  /** `fetch` in production - injected so tests need no network. */
  fetch: typeof fetch;
  /** `GIGET_GITHUB_URL`, when set - the GitHub API base giget downloads from. */
  githubApiUrl: string | undefined;
};

// A release page URL, e.g. https://github.com/org/repo/releases/tag/v1.0.0
const RELEASE_TAG_PATTERN = /\/releases\/tag\/([^?#]+)$/;

/**
 * The GitHub website base for an API base - the same rule giget uses, so one
 * `GIGET_GITHUB_URL` (e.g. a test server) points both lookups at the same place.
 *
 * @param githubApiUrl - `GIGET_GITHUB_URL`, when set.
 * @returns The website base, without a trailing slash.
 * @example
 * ```ts
 * githubWebUrl(undefined); // 'https://github.com'
 * githubWebUrl('https://api.github.com'); // 'https://github.com'
 * ```
 */
export function githubWebUrl(githubApiUrl: string | undefined): string {
  if (githubApiUrl === undefined || githubApiUrl === '') {
    return 'https://github.com';
  }
  return githubApiUrl
    .replace('api.github.com', 'github.com')
    .replace(/\/+$/, '');
}

/**
 * Looks up a repository's latest release from where GitHub's
 * `/releases/latest` page redirects to. Uses the website rather than the API,
 * so it doesn't count towards the API's 60-an-hour limit without a token.
 *
 * Throws when GitHub can't be reached, so an offline run fails clearly
 * instead of falling back to `main` (where giget would quietly use a stale
 * cached copy).
 *
 * @param repository - `<org>/<repo>`.
 * @param options - `fetch` and the GitHub API base.
 * @returns The latest release tag, or `undefined` when there are no releases (or the answer is unexpected).
 * @example
 * ```ts
 * await findLatestRelease('eng-enablement-platform/eep-template-next-app', { fetch, githubApiUrl: undefined }); // 'v1.0.0'
 * ```
 */
export async function findLatestRelease(
  repository: string,
  options: FindLatestReleaseOptions,
): Promise<string | undefined> {
  const response = await options.fetch(
    `${githubWebUrl(options.githubApiUrl)}/${repository}/releases/latest`,
    { method: 'HEAD', redirect: 'manual' },
  );
  // No releases redirects to /releases instead of /releases/tag/<tag>.
  const location = response.headers.get('location') ?? '';
  const tag = RELEASE_TAG_PATTERN.exec(location)?.[1];
  if (response.status < 300 || response.status >= 400 || tag === undefined) {
    return undefined;
  }
  const decoded = decodeURIComponent(tag);
  // Only pass on a tag that is safe as a giget ref.
  return validateRef(decoded) === undefined ? decoded : undefined;
}
