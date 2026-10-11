import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

import { ManifestError } from '../templates/manifest.ts';
import { applyManifest } from './apply-manifest.ts';

/** Downloads a template into a directory - giget's `downloadTemplate` in production. */
export type Downloader = (
  source: string,
  options: { dir: string },
) => Promise<{ dir: string }>;

/** An expected failure with a message that is safe to show the user as-is. */
export class CreateProjectError extends Error {
  override name = 'CreateProjectError';
}

/**
 * Checks a project directory can be created - it must not exist yet, since it
 * could hold someone's work. Separate from the download so it can run before
 * any spinner, and inside the interactive name prompt.
 *
 * @param cwd - The directory the CLI was run from.
 * @param projectName - The project (and directory) name.
 * @returns A problem to show, or `undefined` when the directory is free.
 * @example
 * ```ts
 * checkDestination(process.cwd(), 'my-app'); // undefined, or 'Directory already exists: ...'
 * ```
 */
export function checkDestination(
  cwd: string,
  projectName: string,
): string | undefined {
  const destination = path.resolve(cwd, projectName);
  return existsSync(destination)
    ? `Directory already exists: ${destination}`
    : undefined;
}

type CreateProjectOptions = {
  projectName: string;
  /** Shown in the starter README, e.g. "web-dev-starter" or the GitHub URL. */
  templateName: string;
  templateSource: string;
  cwd: string;
  download: Downloader;
};

/**
 * Downloads a template into a new `<cwd>/<projectName>` directory and applies
 * its `.eep/template.json` (if any). The downloader is injected so tests can
 * check the decisions without a network. If setup fails after the download,
 * the half-made directory is removed.
 *
 * @param options - Project and template names, giget source, working directory and downloader.
 * @returns The absolute path of the created project.
 * @example
 * ```ts
 * await createProject({ projectName: 'my-app', templateSource: 'gh:org/repo', cwd, download });
 * ```
 */
export async function createProject({
  projectName,
  templateName,
  templateSource,
  cwd,
  download,
}: CreateProjectOptions): Promise<string> {
  // Re-checked here so the guarantee holds even if a caller skipped it.
  const destinationProblem = checkDestination(cwd, projectName);
  if (destinationProblem !== undefined) {
    throw new CreateProjectError(destinationProblem);
  }

  let dir: string;
  try {
    ({ dir } = await download(templateSource, {
      dir: path.resolve(cwd, projectName),
    }));
  } catch (error) {
    throw new CreateProjectError(
      `Could not download template "${templateSource}": ${describe(error)}`,
    );
  }

  try {
    await applyManifest({ projectDir: dir, projectName, templateName });
  } catch (error) {
    // We created this directory moments ago, so it is safe to remove.
    await rm(dir, { recursive: true, force: true });
    const reason =
      error instanceof ManifestError
        ? `the template's .eep/template.json is invalid: ${error.message}`
        : describe(error);
    throw new CreateProjectError(
      `Could not set up the project - ${reason} Nothing was created.`,
    );
  }

  return dir;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
