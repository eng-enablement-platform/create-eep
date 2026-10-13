import type { RunCommand } from './commands.ts';

export const INITIAL_COMMIT_MESSAGE = 'chore: initial commit from create-eep';

/**
 * Whether a directory is already inside a git working tree (e.g. a monorepo).
 * A new repository there would be nested inside the existing one.
 *
 * @param dir - The project directory.
 * @param run - The command runner.
 * @returns `true` when `dir` is inside an existing repository.
 * @example
 * ```ts
 * await isInsideGitRepository(projectDir, runCommand);
 * ```
 */
export async function isInsideGitRepository(
  dir: string,
  run: RunCommand,
): Promise<boolean> {
  const { exitCode, output } = await run(
    'git',
    ['rev-parse', '--is-inside-work-tree'],
    { cwd: dir },
  );
  return exitCode === 0 && output.trim() === 'true';
}

/**
 * Initialises a new git repository.
 *
 * @param dir - The project directory.
 * @param run - The command runner.
 * @returns `true` on success.
 * @example
 * ```ts
 * await initRepository(projectDir, runCommand);
 * ```
 */
export async function initRepository(
  dir: string,
  run: RunCommand,
): Promise<boolean> {
  const { exitCode } = await run('git', ['init'], { cwd: dir });
  return exitCode === 0;
}

/** The outcome of the first commit. */
export type CommitResult =
  | { committed: true }
  | { committed: false; reason: 'no-identity' | 'failed'; output: string };

/**
 * Stages everything and makes the first commit. Uses `--no-verify` so the
 * template's own pre-commit hook (lint, tests, build) doesn't run against an
 * untouched template.
 *
 * @param dir - The project directory.
 * @param run - The command runner.
 * @returns Whether it committed, and why not when it didn't.
 * @example
 * ```ts
 * const result = await commitAll(projectDir, runCommand);
 * ```
 */
export async function commitAll(
  dir: string,
  run: RunCommand,
): Promise<CommitResult> {
  const add = await run('git', ['add', '-A'], { cwd: dir });
  if (add.exitCode !== 0) {
    return { committed: false, reason: 'failed', output: add.output };
  }
  const commit = await run(
    'git',
    ['commit', '--no-verify', '-m', INITIAL_COMMIT_MESSAGE],
    { cwd: dir },
  );
  if (commit.exitCode === 0) {
    return { committed: true };
  }
  // git refuses to commit without user.name / user.email configured.
  const noIdentity = /tell me who you are|user\.email|user\.name/i.test(
    commit.output,
  );
  return {
    committed: false,
    reason: noIdentity ? 'no-identity' : 'failed',
    output: commit.output,
  };
}
