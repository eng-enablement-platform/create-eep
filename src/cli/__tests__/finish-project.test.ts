import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandResult, RunCommand } from '../../scaffold/commands.ts';
import {
  askFinishChoices,
  finishProject,
  inspectProject,
} from '../finish-project.ts';
import type { Ui } from '../ui.ts';
import { CANCELLED, createPlainUi } from '../ui.ts';

type Answers = Record<string, CommandResult>;

// Answers by "command args"; anything unlisted succeeds with no output.
const fakeRunner = (answers: Answers = {}) =>
  vi.fn<RunCommand>((command, args, options) => {
    const answer = answers[`${command} ${args.join(' ')}`] ?? {
      exitCode: 0,
      output: '',
    };
    for (const line of answer.output.split('\n').filter(Boolean)) {
      options.onLine?.(line);
    }
    return Promise.resolve(answer);
  });

const NOT_A_REPO: Answers = {
  'git rev-parse --is-inside-work-tree': {
    exitCode: 128,
    output: 'fatal: not a git repository',
  },
};
const MISSING = { exitCode: 127, output: 'ENOENT' };

describe('finishing a project', () => {
  let projectDir: string;
  const quietUi = createPlainUi(vi.fn(), vi.fn());

  const writePackageJson = (content: object) => {
    writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(content),
    );
  };

  beforeEach(() => {
    projectDir = mkdtempSync(path.join(tmpdir(), 'create-eep-finish-'));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  describe(inspectProject, () => {
    it('offers git and a pnpm install for a pnpm template with a dev script', async () => {
      writePackageJson({
        packageManager: 'pnpm@11.28.4',
        scripts: { dev: 'next dev' },
      });

      expect(
        await inspectProject(
          projectDir,
          fakeRunner(NOT_A_REPO),
          'npm/11 node/v24',
        ),
      ).toStrictEqual({
        canInitGit: true,
        packages: {
          packageManager: 'pnpm',
          packageManagerInstalled: true,
          hasDevScript: true,
        },
      });
    });

    it('offers no install for a project without package.json', async () => {
      expect(
        await inspectProject(projectDir, fakeRunner(NOT_A_REPO), undefined),
      ).toStrictEqual({ canInitGit: true });
    });

    it('explains why git is not offered when git is missing', async () => {
      const facts = await inspectProject(
        projectDir,
        fakeRunner({ 'git --version': MISSING }),
        undefined,
      );
      expect(facts.canInitGit).toBe(false);
      expect(facts.gitBlocker).toMatch(/git isn't installed/);
    });

    it('does not offer git inside an existing repository', async () => {
      const facts = await inspectProject(
        projectDir,
        fakeRunner({
          'git rev-parse --is-inside-work-tree': {
            exitCode: 0,
            output: 'true',
          },
        }),
        undefined,
      );
      expect(facts.canInitGit).toBe(false);
      expect(facts.gitBlocker).toMatch(/inside an existing git repository/);
    });

    it('notices a missing package manager', async () => {
      writePackageJson({ packageManager: 'pnpm@11.28.4' });

      const facts = await inspectProject(
        projectDir,
        fakeRunner({ ...NOT_A_REPO, 'pnpm --version': MISSING }),
        undefined,
      );
      expect(facts.packages?.packageManagerInstalled).toBe(false);
    });
  });

  describe(askFinishChoices, () => {
    const facts = {
      canInitGit: true,
      packages: {
        packageManager: 'pnpm' as const,
        packageManagerInstalled: true,
        hasDevScript: true,
      },
    };
    const noFlags = { git: undefined, install: undefined };
    const askingUi = (answers: Record<string, boolean | typeof CANCELLED>) =>
      ({
        ...quietUi,
        confirm: vi.fn((message: string) =>
          Promise.resolve(answers[message] ?? true),
        ),
      }) satisfies Ui;

    it('asks both questions in a terminal', async () => {
      const ui = askingUi({ 'Install dependencies with pnpm?': false });

      expect(await askFinishChoices(facts, noFlags, ui, true)).toStrictEqual({
        git: true,
        install: false,
      });
      expect(ui.confirm).toHaveBeenCalledWith(
        'Initialise a git repository?',
        true,
      );
      expect(ui.confirm).toHaveBeenCalledWith(
        'Install dependencies with pnpm?',
        true,
      );
    });

    it('uses the defaults (yes) without a terminal', async () => {
      const ui = askingUi({});

      expect(await askFinishChoices(facts, noFlags, ui, false)).toStrictEqual({
        git: true,
        install: true,
      });
      expect(ui.confirm).not.toHaveBeenCalled();
    });

    it('lets flags win without asking', async () => {
      const ui = askingUi({});

      expect(
        await askFinishChoices(facts, { git: false, install: false }, ui, true),
      ).toStrictEqual({ git: false, install: false });
      expect(ui.confirm).not.toHaveBeenCalled();
    });

    it('never offers what is not available, even with flags', async () => {
      const ui = askingUi({});
      const unavailable = { canInitGit: false };

      expect(
        await askFinishChoices(
          unavailable,
          { git: true, install: true },
          ui,
          true,
        ),
      ).toStrictEqual({ git: false, install: false });
    });

    it('returns CANCELLED when a question is cancelled', async () => {
      const ui = askingUi({ 'Initialise a git repository?': CANCELLED });

      expect(await askFinishChoices(facts, noFlags, ui, true)).toBe(CANCELLED);
    });
  });

  describe(finishProject, () => {
    const pnpmFacts = {
      canInitGit: true,
      packages: {
        packageManager: 'pnpm' as const,
        packageManagerInstalled: true,
        hasDevScript: true,
      },
    };
    const noFlags = { git: undefined, install: undefined };
    const finish = (
      facts: Parameters<typeof finishProject>[0],
      choices: { git: boolean; install: boolean },
      run: RunCommand,
      flags: Parameters<typeof finishProject>[2] = noFlags,
    ) =>
      finishProject(facts, choices, flags, {
        projectDir,
        projectName: 'my-app',
        ui: quietUi,
        run,
      });

    it('runs git init, then the install, then the first commit', async () => {
      const run = fakeRunner();

      const result = await finish(pnpmFacts, { git: true, install: true }, run);

      expect(
        run.mock.calls.map(([command, args]) => `${command} ${args[0] ?? ''}`),
      ).toStrictEqual(['git init', 'pnpm install', 'git add', 'git commit']);
      expect(result).toStrictEqual({
        nextSteps: ['cd my-app', 'pnpm dev'],
        notes: [],
      });
    });

    it('streams install output to the log task', async () => {
      const log = vi.fn();
      const ui = {
        ...quietUi,
        startLogTask: () => ({ log, succeed: vi.fn(), fail: vi.fn() }),
      } satisfies Ui;

      await finishProject(pnpmFacts, { git: false, install: true }, noFlags, {
        projectDir,
        projectName: 'my-app',
        ui,
        run: fakeRunner({
          'pnpm install': { exitCode: 0, output: 'Packages: +42\nDone in 3s' },
        }),
      });

      expect(log).toHaveBeenCalledWith('Packages: +42');
      expect(log).toHaveBeenCalledWith('Done in 3s');
    });

    it('keeps the project and adds a note when the install fails', async () => {
      const result = await finish(
        pnpmFacts,
        { git: false, install: true },
        fakeRunner({ 'pnpm install': { exitCode: 1, output: 'ERR_PNPM' } }),
      );

      expect(result.nextSteps).toStrictEqual([
        'cd my-app',
        'pnpm install',
        'pnpm dev',
      ]);
      expect(result.notes[0]).toMatch(/Installing dependencies failed/);
    });

    it('suggests the install as a next step when it was skipped', async () => {
      const result = await finish(
        pnpmFacts,
        { git: false, install: false },
        fakeRunner(),
      );

      expect(result.nextSteps).toStrictEqual([
        'cd my-app',
        'pnpm install',
        'pnpm dev',
      ]);
      expect(result.notes).toStrictEqual([]);
    });

    it('explains a missing package manager instead of installing', async () => {
      const run = fakeRunner();
      const result = await finish(
        {
          ...pnpmFacts,
          packages: { ...pnpmFacts.packages, packageManagerInstalled: false },
        },
        { git: false, install: false },
        run,
      );

      expect(run).not.toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.anything(),
      );
      expect(result.notes[0]).toMatch(/uses pnpm, which isn't installed/);
    });

    it('explains a missing git identity', async () => {
      const result = await finish(
        { canInitGit: true },
        { git: true, install: false },
        fakeRunner({
          'git commit --no-verify -m chore: initial commit from create-eep': {
            exitCode: 128,
            output: 'Please tell me who you are',
          },
        }),
      );

      expect(result.notes[0]).toMatch(/no user name or email set/);
    });

    it('shows why git was skipped - unless the user turned git off', async () => {
      const facts = { canInitGit: false, gitBlocker: "git isn't installed." };

      expect(
        (await finish(facts, { git: false, install: false }, fakeRunner()))
          .notes,
      ).toStrictEqual(["git isn't installed."]);
      expect(
        (
          await finish(facts, { git: false, install: false }, fakeRunner(), {
            git: false,
            install: undefined,
          })
        ).notes,
      ).toStrictEqual([]);
    });
  });
});
