/** A template create-eep can scaffold from. */
export type Template = {
  /** Short name used with `--template`. */
  name: string;
  /** One-line description shown in `--help`. */
  description: string;
  /** GitHub repository - `<org>/<repo>`. */
  repository: string;
};

export const TEMPLATES: readonly Template[] = [
  {
    name: 'web-dev-starter',
    description: 'Web dev starter - plain HTML, CSS and JavaScript',
    repository: 'eng-enablement-platform/eep-template-web-dev-starter',
  },
  {
    name: 'next-app',
    description: 'Next.js full-stack app',
    repository: 'eng-enablement-platform/eep-template-next-app',
  },
];

// Pre-selected in the template prompt, and used when not prompting (CI, `--yes`).
export const DEFAULT_TEMPLATE_NAME = 'web-dev-starter';

// Branch, tag or commit names: no leading dash (could read as a flag), no `..`.
const REF_PATTERN = /^(?!-)(?!.*\.\.)[\w./-]+$/;

/**
 * Checks a `--ref` value is a plausible git branch, tag or commit.
 *
 * @param ref - The `--ref` value.
 * @returns A problem to show, or `undefined` when the ref is usable.
 * @example
 * ```ts
 * validateRef('feat/my-change'); // undefined
 * validateRef('../oops'); // 'Ref can only contain ...'
 * ```
 */
export function validateRef(ref: string): string | undefined {
  return REF_PATTERN.test(ref)
    ? undefined
    : 'Ref can only contain letters, numbers, ".", "_", "/" and "-", cannot start with "-" and cannot contain "..".';
}

/**
 * Looks up a built-in template by name. Only EEP templates are supported - to
 * copy any other repository, use giget or degit directly.
 *
 * @param name - The `--template` value.
 * @returns The template, or `undefined` when the name is not a built-in template.
 * @example
 * ```ts
 * findTemplate('next-app')?.repository; // 'eng-enablement-platform/eep-template-next-app'
 * ```
 */
export function findTemplate(name: string): Template | undefined {
  return TEMPLATES.find((candidate) => candidate.name === name);
}

/**
 * Builds the giget source for a template repository, optionally pinned to a
 * branch, tag or commit. Without a ref, giget downloads `main`.
 *
 * @param repository - `<org>/<repo>`.
 * @param ref - Optional branch, tag or commit.
 * @returns The giget source.
 * @example
 * ```ts
 * templateSource('org/repo'); // 'gh:org/repo'
 * templateSource('org/repo', 'v1.0.0'); // 'gh:org/repo#v1.0.0'
 * ```
 */
export function templateSource(repository: string, ref?: string): string {
  return ref === undefined ? `gh:${repository}` : `gh:${repository}#${ref}`;
}
