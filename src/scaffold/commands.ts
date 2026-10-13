import { x } from 'tinyexec';

/** What running a command produced. */
export type CommandResult = {
  /** 0 on success. 127 when the command couldn't be started (e.g. not installed). */
  exitCode: number;
  /** Combined stdout + stderr, line by line. */
  output: string;
};

/**
 * Runs a command - tinyexec in production, a fake in tests. No shell is used,
 * so arguments are never interpreted (no globbing or injection).
 */
export type RunCommand = (
  command: string,
  args: readonly string[],
  options: { cwd: string; onLine?: (line: string) => void },
) => Promise<CommandResult>;

/**
 * Runs a command with tinyexec, streaming each output line to `onLine` (for a
 * live install log) and never throwing - failures come back as a non-zero
 * exit code so callers decide what a failure means.
 *
 * @param command - The executable, e.g. `pnpm`.
 * @param args - Its arguments.
 * @param options - Working directory and an optional per-line callback.
 * @returns The exit code and the combined output.
 * @example
 * ```ts
 * const { exitCode } = await runCommand('pnpm', ['install'], { cwd: projectDir, onLine: log });
 * ```
 */
export const runCommand: RunCommand = async (command, args, options) => {
  const lines: string[] = [];
  try {
    const process = x(command, args, {
      nodeOptions: { cwd: options.cwd },
      throwOnError: false,
    });
    for await (const line of process) {
      lines.push(line);
      options.onLine?.(line);
    }
    return { exitCode: process.exitCode ?? 1, output: lines.join('\n') };
  } catch (error) {
    // Spawn failures (e.g. ENOENT - command not installed) end up here.
    lines.push(error instanceof Error ? error.message : String(error));
    return { exitCode: 127, output: lines.join('\n') };
  }
};

/**
 * Whether a command is installed, by running `<command> --version`. Works the
 * same on every OS (unlike `which`), including Windows `.cmd` shims.
 *
 * @param command - The executable to look for, e.g. `uv`.
 * @param run - The command runner (injected for tests).
 * @returns `true` when the command runs successfully.
 * @example
 * ```ts
 * if (!(await commandExists('pnpm', runCommand))) { ... }
 * ```
 */
export async function commandExists(
  command: string,
  run: RunCommand,
): Promise<boolean> {
  const { exitCode } = await run(command, ['--version'], {
    cwd: process.cwd(),
  });
  return exitCode === 0;
}
