import { existsSync } from 'node:fs';
import path from 'node:path';

/** Downloads a template into a directory - giget's `downloadTemplate` in production. */
export type Downloader = (
  source: string,
  options: { dir: string },
) => Promise<{ dir: string }>;

/** An expected failure with a message that is safe to show the user as-is. */
export class CreateProjectError extends Error {
  override name = 'CreateProjectError';
}

type CreateProjectOptions = {
  projectName: string;
  templateSource: string;
  cwd: string;
  download: Downloader;
};

/**
 * Downloads a template into a new `<cwd>/<projectName>` directory. The
 * downloader is injected so tests can check the decisions without a network.
 *
 * @param options - Project name, giget source, working directory and downloader.
 * @returns The absolute path of the created project.
 * @example
 * ```ts
 * await createProject({ projectName: 'my-app', templateSource: 'gh:org/repo', cwd, download });
 * ```
 */
export async function createProject({
  projectName,
  templateSource,
  cwd,
  download,
}: CreateProjectOptions): Promise<string> {
  const destination = path.resolve(cwd, projectName);

  // Never write into an existing directory - it could hold someone's work.
  if (existsSync(destination)) {
    throw new CreateProjectError(`Directory already exists: ${destination}`);
  }

  try {
    const { dir } = await download(templateSource, { dir: destination });
    return dir;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CreateProjectError(
      `Could not download template "${templateSource}": ${reason}`,
    );
  }
}
