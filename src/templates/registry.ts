/** A template create-eep can scaffold from. */
export type Template = {
  /** Short name used with `--template`. */
  name: string;
  /** One-line description shown in `--help`. */
  description: string;
  /** giget source - `gh:<org>/<repo>`. */
  source: string;
};

export const TEMPLATES: readonly Template[] = [
  {
    name: 'web',
    description: 'Web dev starter - plain HTML, CSS and JavaScript',
    source: 'gh:eng-enablement-platform/eep-template-web-dev-starter',
  },
  {
    name: 'next',
    description: 'Next.js full-stack app',
    source: 'gh:eng-enablement-platform/eep-template-next-app',
  },
];

// Used when no `--template` is given, until interactive prompts land.
export const DEFAULT_TEMPLATE_NAME = 'web';

const GITHUB_URL_PATTERN =
  /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

/**
 * Resolves a `--template` value to a giget source. Accepts a built-in template
 * name, a pasted GitHub repo URL, or a giget `gh:` source as-is.
 *
 * @param input - The `--template` value.
 * @returns The giget source, or `undefined` when the input is not recognised.
 * @example
 * ```ts
 * resolveTemplateSource('next'); // 'gh:eng-enablement-platform/eep-template-next-app'
 * resolveTemplateSource('https://github.com/org/repo.git'); // 'gh:org/repo'
 * ```
 */
export function resolveTemplateSource(input: string): string | undefined {
  const builtIn = TEMPLATES.find((template) => template.name === input);
  if (builtIn) {
    return builtIn.source;
  }

  /*
   * giget does not accept browser URLs - given one it fetches the HTML page
   * and fails with TAR_BAD_ARCHIVE - so normalise to its `gh:` shorthand.
   */
  const githubMatch = GITHUB_URL_PATTERN.exec(input);
  if (githubMatch) {
    const [, owner, repo] = githubMatch;
    return `gh:${String(owner)}/${String(repo)}`;
  }

  if (input.startsWith('gh:')) {
    return input;
  }

  return undefined;
}
