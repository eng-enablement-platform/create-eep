import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import packageJson from '../../../package.json' with { type: 'json' };
import type { CliDependencies } from '../run-cli.ts';
import { runCli } from '../run-cli.ts';
import type { Answer, Ui, Validator } from '../ui.ts';
import { CANCELLED, createPlainUi } from '../ui.ts';

type FakeAnswers = {
  projectName?: Answer<string>;
  template?: Answer<string>;
};

// An interactive Ui that answers prompts from `answers` and records what happened.
const createFakeUi = (answers: FakeAnswers) => {
  const errors: string[] = [];
  const ui = {
    interactive: true,
    intro: vi.fn(),
    askProjectName: vi.fn((_validate: Validator) =>
      Promise.resolve(answers.projectName ?? CANCELLED),
    ),
    askTemplate: vi.fn(() => Promise.resolve(answers.template ?? CANCELLED)),
    startTask: vi.fn(() => ({ succeed: vi.fn(), fail: vi.fn() })),
    success: vi.fn(),
    error: vi.fn((message: string) => errors.push(message)),
    cancelled: vi.fn(),
  } satisfies Ui;
  return { ui, errors };
};

describe(runCli, () => {
  let cwd: string;
  let download: ReturnType<typeof vi.fn<CliDependencies['download']>>;

  beforeEach(() => {
    cwd = mkdtempSync(path.join(tmpdir(), 'create-eep-test-'));
    download = vi.fn<CliDependencies['download']>((_source, { dir }) =>
      Promise.resolve({ dir }),
    );
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  describe('non-interactive (CI, piped output)', () => {
    let output: { stdout: string; stderr: string };

    const run = (args: string[]) => {
      const stdout = (text: string) => (output.stdout += text);
      const stderr = (text: string) => (output.stderr += text);
      return runCli(['node', 'create-eep', ...args], {
        cwd,
        download,
        ui: createPlainUi(stdout, stderr),
        stdout,
        stderr,
      });
    };

    beforeEach(() => {
      output = { stdout: '', stderr: '' };
    });

    it('prints the package version for --version', async () => {
      expect(await run(['--version'])).toBe(0);
      expect(output.stdout.trim()).toBe(packageJson.version);
      expect(download).not.toHaveBeenCalled();
    });

    it('lists the built-in templates in --help', async () => {
      expect(await run(['--help'])).toBe(0);
      expect(output.stdout).toContain('web');
      expect(output.stdout).toContain('next');
      expect(download).not.toHaveBeenCalled();
    });

    it('fails with usage when the project name is missing', async () => {
      expect(await run([])).toBe(1);
      expect(output.stderr).toContain('Missing project name');
      expect(download).not.toHaveBeenCalled();
    });

    it('fails on an invalid project name', async () => {
      expect(await run(['My App'])).toBe(1);
      expect(output.stderr).toContain('Invalid project name');
      expect(download).not.toHaveBeenCalled();
    });

    it('fails on an unknown template and lists the available ones', async () => {
      expect(await run(['my-app', '--template', 'nope'])).toBe(1);
      expect(output.stderr).toContain('Unknown template "nope"');
      expect(output.stderr).toContain('next');
      expect(download).not.toHaveBeenCalled();
    });

    it('refuses to write into an existing directory', async () => {
      mkdirSync(path.join(cwd, 'my-app'));

      expect(await run(['my-app'])).toBe(1);
      expect(output.stderr).toContain('already exists');
      expect(download).not.toHaveBeenCalled();
    });

    it('downloads the default template without prompting', async () => {
      expect(await run(['my-app'])).toBe(0);
      expect(download).toHaveBeenCalledWith(
        'gh:eng-enablement-platform/eep-template-web-dev-starter',
        { dir: path.join(cwd, 'my-app') },
      );
      expect(output.stdout).toContain('cd my-app');
    });

    it('downloads the chosen built-in template', async () => {
      expect(await run(['my-app', '-t', 'next'])).toBe(0);
      expect(download).toHaveBeenCalledWith(
        'gh:eng-enablement-platform/eep-template-next-app',
        expect.anything(),
      );
    });

    it('downloads from a pasted GitHub URL', async () => {
      expect(
        await run(['my-app', '--template', 'https://github.com/org/repo.git']),
      ).toBe(0);
      expect(download).toHaveBeenCalledWith('gh:org/repo', expect.anything());
    });

    it('reports a failed download as a friendly error', async () => {
      download.mockRejectedValueOnce(new Error('404 Not Found'));

      expect(await run(['my-app'])).toBe(1);
      expect(output.stderr).toContain('Could not download template');
      expect(output.stderr).toContain('404 Not Found');
    });
  });

  describe('interactive (terminal)', () => {
    const run = (args: string[], ui: Ui) =>
      runCli(['node', 'create-eep', ...args], {
        cwd,
        download,
        ui,
        stdout: vi.fn(),
        stderr: vi.fn(),
      });

    it('asks for the name and template when neither is given', async () => {
      const { ui } = createFakeUi({ projectName: 'my-app', template: 'next' });

      expect(await run([], ui)).toBe(0);
      expect(ui.askProjectName).toHaveBeenCalledOnce();
      expect(ui.askTemplate).toHaveBeenCalledOnce();
      expect(download).toHaveBeenCalledWith(
        'gh:eng-enablement-platform/eep-template-next-app',
        { dir: path.join(cwd, 'my-app') },
      );
      expect(ui.success).toHaveBeenCalledOnce();
    });

    it('only asks for the template when the name is given', async () => {
      const { ui } = createFakeUi({ template: 'web' });

      expect(await run(['my-app'], ui)).toBe(0);
      expect(ui.askProjectName).not.toHaveBeenCalled();
      expect(ui.askTemplate).toHaveBeenCalledOnce();
    });

    it('asks nothing when the name and template are both given', async () => {
      const { ui } = createFakeUi({});

      expect(await run(['my-app', '-t', 'next'], ui)).toBe(0);
      expect(ui.askProjectName).not.toHaveBeenCalled();
      expect(ui.askTemplate).not.toHaveBeenCalled();
    });

    it('skips prompts with --yes and uses the default template', async () => {
      const { ui } = createFakeUi({});

      expect(await run(['my-app', '--yes'], ui)).toBe(0);
      expect(ui.askTemplate).not.toHaveBeenCalled();
      expect(download).toHaveBeenCalledWith(
        'gh:eng-enablement-platform/eep-template-web-dev-starter',
        expect.anything(),
      );
    });

    it('fails with usage for --yes without a project name', async () => {
      const { ui, errors } = createFakeUi({});

      expect(await run(['--yes'], ui)).toBe(1);
      expect(ui.askProjectName).not.toHaveBeenCalled();
      expect(errors.join()).toContain('Missing project name');
    });

    it.each([
      ['project name', {}, []],
      ['template', { projectName: 'my-app' }, []],
    ] as const)(
      'exits 130 without downloading when the %s prompt is cancelled',
      async (_prompt, answers, args) => {
        const { ui } = createFakeUi(answers);

        expect(await run([...args], ui)).toBe(130);
        expect(ui.cancelled).toHaveBeenCalledOnce();
        expect(download).not.toHaveBeenCalled();
      },
    );

    it('validates the typed name against the naming rules and existing directories', async () => {
      mkdirSync(path.join(cwd, 'taken'));
      const { ui } = createFakeUi({ projectName: 'my-app', template: 'web' });

      await run([], ui);
      const validate = ui.askProjectName.mock.calls[0]?.[0];

      expect(validate?.('my-app')).toBeUndefined();
      expect(validate?.('My App')).toMatch(/can only contain/);
      expect(validate?.('taken')).toMatch(/already exists/);
    });

    it('reports a failed download through the task and error output', async () => {
      download.mockRejectedValueOnce(new Error('404 Not Found'));
      const { ui, errors } = createFakeUi({ template: 'web' });

      expect(await run(['my-app'], ui)).toBe(1);
      expect(errors.join()).toContain('404 Not Found');
      expect(ui.success).not.toHaveBeenCalled();
    });
  });
});
