import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  FeatureChoices,
  TemplateManifest,
} from '../templates/manifest.ts';
import {
  MANIFEST_DIRECTORY,
  MANIFEST_FILE,
  ManifestError,
  parseManifest,
  renderPlaceholders,
} from '../templates/manifest.ts';

/**
 * Reads and validates a downloaded template's `.eep/template.json`.
 *
 * @param projectDir - The downloaded project directory.
 * @returns The manifest, or `undefined` when the template has none (it is then used as-is).
 * @example
 * ```ts
 * const manifest = await loadManifest(projectDir);
 * ```
 */
export async function loadManifest(
  projectDir: string,
): Promise<TemplateManifest | undefined> {
  const manifestPath = path.join(projectDir, MANIFEST_DIRECTORY, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    return undefined;
  }
  let content: unknown;
  try {
    content = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ManifestError(
      `Could not read ${MANIFEST_DIRECTORY}/${MANIFEST_FILE}: ${reason}`,
    );
  }
  return parseManifest(content);
}

type ApplyManifestOptions = {
  projectDir: string;
  manifest: TemplateManifest;
  /** Whether each optional feature is kept - every feature id must be decided. */
  choices: FeatureChoices;
  projectName: string;
  templateName: string;
};

/**
 * Turns a freshly downloaded template into a project: removes
 * template-maintenance paths and dropped features (their paths and
 * package.json scripts), swaps in the starter README, sets the package.json
 * name, then deletes `.eep/`.
 *
 * @param options - Project directory, manifest, feature choices, project and template names.
 * @example
 * ```ts
 * await applyManifest({ projectDir, manifest, choices: { docs: false }, projectName: 'my-app', templateName: 'next-app' });
 * ```
 */
export async function applyManifest({
  projectDir,
  manifest,
  choices,
  projectName,
  templateName,
}: ApplyManifestOptions): Promise<void> {
  const dropped = manifest.features.filter(
    (feature) => choices[feature.id] !== true,
  );

  const pathsToRemove = [
    ...manifest.remove,
    ...dropped.flatMap((feature) => feature.remove),
  ];
  for (const relativePath of pathsToRemove) {
    await rm(path.join(projectDir, relativePath), {
      recursive: true,
      force: true,
    });
  }

  const manifestDir = path.join(projectDir, MANIFEST_DIRECTORY);
  if (manifest.readme !== undefined) {
    const starter = await readFile(
      path.join(manifestDir, manifest.readme),
      'utf8',
    );
    await writeFile(
      path.join(projectDir, 'README.md'),
      renderPlaceholders(starter, { projectName, templateName }),
    );
  }

  await updatePackageJson(
    projectDir,
    projectName,
    dropped.flatMap((feature) => feature.scripts),
  );
  await rm(manifestDir, { recursive: true, force: true });
}

/*
 * Sets the package.json name and removes scripts belonging to dropped
 * features, keeping every other field and its order.
 */
const updatePackageJson = async (
  projectDir: string,
  projectName: string,
  scriptsToRemove: readonly string[],
): Promise<void> => {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return;
  }
  const packageJson = JSON.parse(
    await readFile(packageJsonPath, 'utf8'),
  ) as Record<string, unknown>;
  packageJson.name = projectName;

  const { scripts } = packageJson;
  if (typeof scripts === 'object' && scripts !== null) {
    const remaining = Object.fromEntries(
      Object.entries(scripts).filter(
        ([name]) => !scriptsToRemove.includes(name),
      ),
    );
    packageJson.scripts = remaining;
  }
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
};
