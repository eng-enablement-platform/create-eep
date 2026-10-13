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
    name: 'web-dev-starter',
    description: 'Web dev starter - plain HTML, CSS and JavaScript',
    source: 'gh:eng-enablement-platform/eep-template-web-dev-starter',
  },
  {
    name: 'next-app',
    description: 'Next.js full-stack app',
    source: 'gh:eng-enablement-platform/eep-template-next-app',
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
 * Resolves a built-in template name to its giget source, optionally pinned to
 * a branch, tag or commit. Only EEP templates are supported - to copy any
 * other repository, use giget or degit directly.
 *
 * @param name - The `--template` value.
 * @param ref - Optional branch, tag or commit (`--ref`), e.g. for testing a template change.
 * @returns The giget source, or `undefined` when the name is not a built-in template.
 * @example
 * ```ts
 * resolveTemplateSource('next-app'); // 'gh:eng-enablement-platform/eep-template-next-app'
 * resolveTemplateSource('next-app', 'feat/x'); // 'gh:eng-enablement-platform/eep-template-next-app#feat/x'
 * ```
 */
export function resolveTemplateSource(
  name: string,
  ref?: string,
): string | undefined {
  const template = TEMPLATES.find((candidate) => candidate.name === name);
  if (template === undefined) {
    return undefined;
  }
  return ref === undefined ? template.source : `${template.source}#${ref}`;
}
