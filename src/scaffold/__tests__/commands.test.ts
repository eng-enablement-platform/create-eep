import { describe, expect, it, vi } from 'vitest';

import { commandExists, runCommand } from '../commands.ts';

// These run real processes - kept to `node`, which is always present.
describe(runCommand, () => {
  it('returns exit code 0 and streams each output line', async () => {
    const onLine = vi.fn();
    const result = await runCommand(
      process.execPath,
      ['-e', 'console.log("one"); console.log("two")'],
      { cwd: process.cwd(), onLine },
    );

    expect(result.exitCode).toBe(0);
    expect(onLine).toHaveBeenCalledWith('one');
    expect(onLine).toHaveBeenCalledWith('two');
  });

  it('returns a non-zero exit code instead of throwing', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', 'process.exit(3)'],
      {
        cwd: process.cwd(),
      },
    );

    expect(result.exitCode).toBe(3);
  });

  it('returns a non-zero exit code for a command that does not exist', async () => {
    const result = await runCommand('create-eep-no-such-command', [], {
      cwd: process.cwd(),
    });

    expect(result.exitCode).not.toBe(0);
  });
});

describe(commandExists, () => {
  it('is true for an installed command and false otherwise', async () => {
    expect(await commandExists(process.execPath, runCommand)).toBe(true);
    expect(await commandExists('create-eep-no-such-command', runCommand)).toBe(
      false,
    );
  });
});
