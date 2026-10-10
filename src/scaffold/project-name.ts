// npm package-name rules, minus scopes - the name is also the directory name.
const PROJECT_NAME_PATTERN = /^[a-z0-9~-][a-z0-9._~-]*$/;
const MAX_PROJECT_NAME_LENGTH = 214;

/**
 * Checks a project name is usable as both a directory and an npm package name.
 *
 * @param projectName - The name passed on the command line.
 * @returns A human-readable problem, or `undefined` when the name is valid.
 * @example
 * ```ts
 * validateProjectName('my-app'); // undefined
 * validateProjectName('My App'); // 'Project name can only contain ...'
 * ```
 */
export function validateProjectName(projectName: string): string | undefined {
  if (projectName.length > MAX_PROJECT_NAME_LENGTH) {
    return `Project name must be ${String(MAX_PROJECT_NAME_LENGTH)} characters or fewer.`;
  }
  if (!PROJECT_NAME_PATTERN.test(projectName)) {
    return 'Project name can only contain lowercase letters, numbers, ".", "_", "~" and "-", and cannot start with "." or "_".';
  }
  return undefined;
}
