import path from 'node:path';

/** Where a template keeps its create-eep setup - removed from generated projects. */
export const MANIFEST_DIRECTORY = '.eep';
export const MANIFEST_FILE = 'template.json';

const SUPPORTED_VERSIONS = [1, 2] as const;
const KNOWN_KEYS: Record<1 | 2, readonly string[]> = {
  1: ['version', 'remove', 'readme'],
  2: ['version', 'remove', 'readme', 'features'],
};
const FEATURE_KEYS = ['id', 'prompt', 'default', 'remove', 'scripts'];
const FEATURE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** An optional part of a template the user can keep or drop (manifest version 2). */
export type TemplateFeature = {
  /** Used with `--with <id>` / `--without <id>`. */
  id: string;
  /** Yes/no question asked in a terminal. */
  prompt: string;
  /** Used when not asked (CI, `--yes`) and pre-selected when asked. */
  default: boolean;
  /** Paths removed when the feature is dropped. */
  remove: string[];
  /** package.json scripts removed when the feature is dropped. */
  scripts: string[];
};

/** A template's `.eep/template.json`: what create-eep does after downloading it. */
export type TemplateManifest = {
  version: 1 | 2;
  /** Template-maintenance paths always removed from generated projects. */
  remove: string[];
  /** Starter README inside `.eep/` that replaces the template's own README. */
  readme?: string;
  features: TemplateFeature[];
};

/** Whether each optional feature is kept, by feature id. */
export type FeatureChoices = Record<string, boolean>;

/** A manifest or feature-selection problem, safe to show the user as-is. */
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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

// Validates a list of paths, naming `field` in the error.
const parsePaths = (value: unknown, field: string): string[] => {
  const paths = value ?? [];
  if (!isStringArray(paths)) {
    throw new ManifestError(`"${field}" must be an array of paths.`);
  }
  const unsafe = paths.filter((entry) => !isSafeRelativePath(entry));
  if (unsafe.length > 0) {
    throw new ManifestError(
      `"${field}" paths must stay inside the project: ${unsafe.join(', ')}`,
    );
  }
  return paths;
};

const rejectUnknownKeys = (
  value: Record<string, unknown>,
  known: readonly string[],
  where: string,
): void => {
  const unknown = Object.keys(value).filter((key) => !known.includes(key));
  if (unknown.length > 0) {
    throw new ManifestError(
      `Unknown ${where} field(s): ${unknown.join(', ')}. Supported: ${known.join(', ')}.`,
    );
  }
};

const parseFeature = (value: unknown, index: number): TemplateFeature => {
  const where = `features[${String(index)}]`;
  if (!isObject(value)) {
    throw new ManifestError(`${where} must be an object.`);
  }
  rejectUnknownKeys(value, FEATURE_KEYS, where);
  const { id, prompt } = value;
  if (typeof id !== 'string' || !FEATURE_ID_PATTERN.test(id)) {
    throw new ManifestError(
      `${where}.id must be lowercase letters, numbers and dashes (e.g. "docs").`,
    );
  }
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    throw new ManifestError(`Feature "${id}" needs a "prompt" question.`);
  }
  if (typeof value.default !== 'boolean') {
    throw new ManifestError(`Feature "${id}" needs a true/false "default".`);
  }
  const scripts = value.scripts ?? [];
  if (!isStringArray(scripts)) {
    throw new ManifestError(
      `Feature "${id}" "scripts" must be an array of script names.`,
    );
  }
  return {
    id,
    prompt,
    default: value.default,
    remove: parsePaths(value.remove, `features.${id}.remove`),
    scripts,
  };
};

/**
 * Validates parsed `.eep/template.json` content. Unknown keys are rejected so a
 * typo (e.g. `remvoe`) fails loudly instead of silently doing nothing.
 *
 * @param content - The parsed JSON.
 * @returns The validated manifest, with defaults filled in.
 * @example
 * ```ts
 * parseManifest({ version: 1, readme: 'README.md' }); // { version: 1, remove: [], readme: 'README.md', features: [] }
 * ```
 */
export function parseManifest(content: unknown): TemplateManifest {
  if (!isObject(content)) {
    throw new ManifestError('Manifest must be a JSON object.');
  }
  const { version } = content;
  if (version !== 1 && version !== 2) {
    throw new ManifestError(
      `Unsupported manifest version ${JSON.stringify(version)} - this create-eep supports version ${SUPPORTED_VERSIONS.join(' or ')}. Try the latest create-eep.`,
    );
  }
  rejectUnknownKeys(content, KNOWN_KEYS[version], 'manifest');

  const remove = parsePaths(content.remove, 'remove');

  const features = content.features ?? [];
  if (!Array.isArray(features)) {
    throw new ManifestError('"features" must be an array.');
  }
  const parsedFeatures = features.map(parseFeature);
  const ids = parsedFeatures.map((feature) => feature.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate !== undefined) {
    throw new ManifestError(
      `Feature id "${duplicate}" is used more than once.`,
    );
  }

  const { readme } = content;
  if (
    readme !== undefined &&
    (typeof readme !== 'string' || !isSafeRelativePath(readme))
  ) {
    throw new ManifestError(
      '"readme" must be a relative path inside the .eep folder.',
    );
  }

  return {
    version,
    remove,
    ...(readme === undefined ? {} : { readme }),
    features: parsedFeatures,
  };
}

/**
 * Applies `--with` / `--without` to a template's features. Features named in
 * neither are left undecided - asked in a terminal, otherwise defaulted.
 *
 * @param features - The template's optional features.
 * @param flags - Feature ids from `--with` and `--without`.
 * @returns The decided choices and the features still to decide.
 * @example
 * ```ts
 * resolveFeatureFlags(features, { with: ['docs'], without: [] });
 * // { choices: { docs: true }, undecided: [diagramsFeature, devcontainerFeature] }
 * ```
 */
export function resolveFeatureFlags(
  features: readonly TemplateFeature[],
  flags: { with: readonly string[]; without: readonly string[] },
): { choices: FeatureChoices; undecided: TemplateFeature[] } {
  const known = features.map((feature) => feature.id);
  const unknown = [...flags.with, ...flags.without].filter(
    (id) => !known.includes(id),
  );
  if (unknown.length > 0) {
    throw new ManifestError(
      known.length === 0
        ? `This template has no optional extras, so --with/--without "${unknown.join('", "')}" can't apply.`
        : `Unknown optional extra(s): ${unknown.join(', ')}. This template offers: ${known.join(', ')}.`,
    );
  }
  const conflicting = flags.with.filter((id) => flags.without.includes(id));
  if (conflicting.length > 0) {
    throw new ManifestError(
      `Both --with and --without given for: ${conflicting.join(', ')}.`,
    );
  }

  const choices: FeatureChoices = {};
  for (const id of flags.with) choices[id] = true;
  for (const id of flags.without) choices[id] = false;
  return {
    choices,
    undecided: features.filter((feature) => !(feature.id in choices)),
  };
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
