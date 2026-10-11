import path from 'node:path';

/** Where a template keeps its create-eep setup - removed from generated projects. */
export const MANIFEST_DIRECTORY = '.eep';
export const MANIFEST_FILE = 'template.json';

const SUPPORTED_VERSION = 1;
const KNOWN_KEYS = new Set(['version', 'remove', 'readme']);

/**
 * A template's `.eep/template.json`: what create-eep does after downloading it.
 * Optional features (e.g. a docs site prompt) are added in a later version.
 */
export type TemplateManifest = {
  version: 1;
  /** Template-maintenance paths always removed from generated projects. */
  remove: string[];
  /** Starter README inside `.eep/` that replaces the template's own README. */
  readme?: string;
};

/** A manifest problem, worded for the template author. */
export class ManifestError extends Error {
  override name = 'ManifestError';
}

/**
 * Whether a manifest path stays inside the project - relative, and never
 * climbing out with `..`. Guards against a manifest deleting files elsewhere.
 *
 * @param relativePath - A path from the manifest.
 * @returns `true` when the path is safe to act on.
 */
export function isSafeRelativePath(relativePath: string): boolean {
  if (relativePath === '' || path.isAbsolute(relativePath)) {
    return false;
  }
  const normalised = path.posix.normalize(relativePath.replaceAll('\\', '/'));
  return (
    normalised !== '.' &&
    normalised !== '..' &&
    !normalised.startsWith('../') &&
    !normalised.startsWith('/')
  );
}

/**
 * Validates parsed `.eep/template.json` content. Unknown keys are rejected so a
 * typo (e.g. `remvoe`) fails loudly instead of silently doing nothing.
 *
 * @param content - The parsed JSON.
 * @returns The validated manifest, with defaults filled in.
 * @example
 * ```ts
 * parseManifest({ version: 1, readme: 'README.md' }); // { version: 1, remove: [], readme: 'README.md' }
 * ```
 */
export function parseManifest(content: unknown): TemplateManifest {
  if (
    typeof content !== 'object' ||
    content === null ||
    Array.isArray(content)
  ) {
    throw new ManifestError('Manifest must be a JSON object.');
  }
  const manifest = content as Record<string, unknown>;

  const unknownKeys = Object.keys(manifest).filter(
    (key) => !KNOWN_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new ManifestError(
      `Unknown manifest field(s): ${unknownKeys.join(', ')}. This create-eep supports: ${[...KNOWN_KEYS].join(', ')}.`,
    );
  }

  if (manifest.version !== SUPPORTED_VERSION) {
    throw new ManifestError(
      `Unsupported manifest version ${JSON.stringify(manifest.version)} - this create-eep supports version ${String(SUPPORTED_VERSION)}. Try the latest create-eep.`,
    );
  }

  const remove = manifest.remove ?? [];
  if (
    !Array.isArray(remove) ||
    !remove.every((entry) => typeof entry === 'string')
  ) {
    throw new ManifestError('"remove" must be an array of paths.');
  }
  const unsafe = remove.filter((entry) => !isSafeRelativePath(entry));
  if (unsafe.length > 0) {
    throw new ManifestError(
      `"remove" paths must stay inside the project: ${unsafe.join(', ')}`,
    );
  }

  const { readme } = manifest;
  if (readme !== undefined) {
    if (typeof readme !== 'string' || !isSafeRelativePath(readme)) {
      throw new ManifestError(
        '"readme" must be a relative path inside the .eep folder.',
      );
    }
    return { version: SUPPORTED_VERSION, remove, readme };
  }
  return { version: SUPPORTED_VERSION, remove };
}

/**
 * Fills `{{placeholder}}` values in a template file. Unknown placeholders are
 * left as-is so they are easy to spot in the generated file.
 *
 * @param text - Template text, e.g. the starter README.
 * @param values - Placeholder values by name.
 * @returns The text with known placeholders replaced.
 * @example
 * ```ts
 * renderPlaceholders('# {{projectName}}', { projectName: 'my-app' }); // '# my-app'
 * ```
 */
export function renderPlaceholders(
  text: string,
  values: Readonly<Record<string, string>>,
): string {
  return text.replaceAll(
    /\{\{(\w+)\}\}/g,
    (placeholder, name: string) => values[name] ?? placeholder,
  );
}
