import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  MANIFEST_DIRECTORY,
  MANIFEST_FILE,
  ManifestError,
  parseManifest,
  renderPlaceholders,
} from '../templates/manifest.ts';

type ApplyManifestOptions = {
  projectDir: string;
  projectName: string;
  templateName: string;
};

/**
 * Turns a freshly downloaded template into a project, following its
 * `.eep/template.json`: removes template-maintenance paths, swaps in the
 * starter README, sets the package.json name, then deletes `.eep/`.
 * Templates without a manifest (e.g. any GitHub repo) are left as-is.
 *
 * @param options - The downloaded project directory, project and template names.
 * @returns `true` when a manifest was found and applied.
 * @example
 * ```ts
 * await applyManifest({ projectDir, projectName: 'my-app', templateName: 'web-dev-starter' });
 * ```
 */
export async function applyManifest({
  projectDir,
  projectName,
  templateName,
}: ApplyManifestOptions): Promise<boolean> {
  const manifestDir = path.join(projectDir, MANIFEST_DIRECTORY);
  const manifestPath = path.join(manifestDir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    return false;
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
  const manifest = parseManifest(content);

  for (const relativePath of manifest.remove) {
    await rm(path.join(projectDir, relativePath), {
      recursive: true,
      force: true,
    });
  }

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

  await setPackageName(projectDir, projectName);
  await rm(manifestDir, { recursive: true, force: true });
  return true;
}

// Rename the template's package.json `name`, keeping every other field and its order.
const setPackageName = async (
  projectDir: string,
  projectName: string,
): Promise<void> => {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return;
  }
  const packageJson = JSON.parse(
    await readFile(packageJsonPath, 'utf8'),
  ) as Record<string, unknown>;
  packageJson.name = projectName;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
};
