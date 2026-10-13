import { describe, expect, it, vi } from 'vitest';

import type { CommandResult, RunCommand } from '../commands.ts';
import {
  commitAll,
  INITIAL_COMMIT_MESSAGE,
  initRepository,
  isInsideGitRepository,
} from '../git.ts';

// A fake runner that answers by "command args" and records every call.
const fakeRunner = (answers: Record<string, CommandResult>) =>
  vi.fn<RunCommand>((command, args) =>
    Promise.resolve(
      answers[`${command} ${args.join(' ')}`] ?? { exitCode: 0, output: '' },
    ),
  );

describe(isInsideGitRepository, () => {
  it('is true inside an existing work tree', async () => {
    const run = fakeRunner({
      'git rev-parse --is-inside-work-tree': { exitCode: 0, output: 'true\n' },
    });
    expect(await isInsideGitRepository('/dir', run)).toBe(true);
  });

  it('is false outside a repository', async () => {
    const run = fakeRunner({
      'git rev-parse --is-inside-work-tree': {
        exitCode: 128,
        output: 'fatal: not a git repository',
      },
    });
    expect(await isInsideGitRepository('/dir', run)).toBe(false);
  });
});

describe(initRepository, () => {
  it('runs git init in the project directory', async () => {
    const run = fakeRunner({});
    expect(await initRepository('/dir', run)).toBe(true);
    expect(run).toHaveBeenCalledWith('git', ['init'], { cwd: '/dir' });
  });
});

describe(commitAll, () => {
  it('stages everything and commits with --no-verify', async () => {
    const run = fakeRunner({});
    expect(await commitAll('/dir', run)).toStrictEqual({ committed: true });
    expect(run).toHaveBeenNthCalledWith(1, 'git', ['add', '-A'], {
      cwd: '/dir',
    });
    expect(run).toHaveBeenNthCalledWith(
      2,
      'git',
      ['commit', '--no-verify', '-m', INITIAL_COMMIT_MESSAGE],
      { cwd: '/dir' },
    );
  });

  it('reports a missing git identity', async () => {
    const run = fakeRunner({
      [`git commit --no-verify -m ${INITIAL_COMMIT_MESSAGE}`]: {
        exitCode: 128,
        output: 'Author identity unknown\n*** Please tell me who you are.',
      },
    });
    expect(await commitAll('/dir', run)).toMatchObject({
      committed: false,
      reason: 'no-identity',
    });
  });

  it('reports any other commit failure', async () => {
    const run = fakeRunner({
      'git add -A': { exitCode: 1, output: 'fatal: something broke' },
    });
    expect(await commitAll('/dir', run)).toMatchObject({
      committed: false,
      reason: 'failed',
    });
  });
});
