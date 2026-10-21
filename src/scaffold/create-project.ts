import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

import { templateSource } from '../templates/registry.ts';
import type { DownloadTarget } from './download-errors.ts';
import { describeDownloadError } from './download-errors.ts';
import type { FindLatestRelease } from './latest-release.ts';

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

type DownloadProjectOptions = DownloadTarget & {
  projectName: string;
  cwd: string;
  download: Downloader;
  findLatestRelease: FindLatestRelease;
};

/**
 * Downloads a template into a new `<cwd>/<projectName>` directory - from
 * `ref` when given, otherwise from the template's latest release, falling
 * back to `main` when it has none. Dependencies are injected so tests can
 * check the decisions without a network.
 *
 * @param options - Project name, template (name, repository, `--ref`), working directory, downloader and release lookup.
 * @returns The absolute path of the downloaded project, and the ref used (`undefined` means `main`).
 * @example
 * ```ts
 * const { dir, ref } = await downloadProject({ projectName: 'my-app', templateName: 'next-app', repository: 'org/repo', cwd, download, findLatestRelease });
 * ```
 */
export async function downloadProject({
  projectName,
  cwd,
  download,
  findLatestRelease,
  ...target
}: DownloadProjectOptions): Promise<{ dir: string; ref: string | undefined }> {
  // Re-checked here so the guarantee holds even if a caller skipped it.
  const destinationProblem = checkDestination(cwd, projectName);
  if (destinationProblem !== undefined) {
    throw new CreateProjectError(destinationProblem);
  }

  try {
    const ref = target.ref ?? (await findLatestRelease(target.repository));
    const { dir } = await download(templateSource(target.repository, ref), {
      dir: path.resolve(cwd, projectName),
    });
    return { dir, ref };
  } catch (error) {
    throw new CreateProjectError(describeDownloadError(error, target));
  }
}

/**
 * Removes a project directory this run created, after a failure or cancel, so
 * nothing half-made is left behind. Only call it on a directory we just
 * downloaded - `checkDestination` guarantees it did not exist before.
 *
 * @param projectDir - The directory returned by {@link downloadProject}.
 */
export async function removeProject(projectDir: string): Promise<void> {
  await rm(projectDir, { recursive: true, force: true });
}
