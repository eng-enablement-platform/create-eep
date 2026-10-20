import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
  /** Answers to yes/no questions, keyed by the prompt text. Unlisted: the default. */
  confirms?: Record<string, Answer<boolean>>;
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
    confirm: vi.fn((message: string, initialValue: boolean) =>
      Promise.resolve(answers.confirms?.[message] ?? initialValue),
    ),
    startTask: vi.fn(() => ({ succeed: vi.fn(), fail: vi.fn() })),
    startLogTask: vi.fn(() => ({
      log: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
    })),
    success: vi.fn(),
    error: vi.fn((message: string) => errors.push(message)),
    cancelled: vi.fn(),
  } satisfies Ui;
  return { ui, errors };
};

const FEATURES_MANIFEST = JSON.stringify({
  version: 2,
  readme: 'README.md',
  features: [
    { id: 'docs', prompt: 'Docs?', default: false, remove: ['docs/'] },
    {
      id: 'diagrams',
      prompt: 'Diagrams?',
      default: true,
      remove: ['diagrams/'],
    },
  ],
});

// Simulates giget writing a template with a .eep/ manifest, docs/ and diagrams/.
const fakeTemplateDownload =
  (manifest: string): CliDependencies['download'] =>
  (_source, { dir }) => {
    for (const folder of ['.eep', 'docs', 'diagrams']) {
      mkdirSync(path.join(dir, folder), { recursive: true });
    }
    writeFileSync(path.join(dir, '.eep', 'template.json'), manifest);
    writeFileSync(path.join(dir, '.eep', 'README.md'), '# {{projectName}}');
    return Promise.resolve({ dir });
  };

// git and package managers are faked: every command succeeds with no output.
const okRunner = () =>
  vi.fn<CliDependencies['run']>(() =>
    Promise.resolve({ exitCode: 0, output: '' }),
  );

describe(runCli, () => {
  let cwd: string;
  let download: ReturnType<typeof vi.fn<CliDependencies['download']>>;
  let findLatestRelease: ReturnType<
    typeof vi.fn<CliDependencies['findLatestRelease']>
  >;

  beforeEach(() => {
    cwd = mkdtempSync(path.join(tmpdir(), 'create-eep-test-'));
    download = vi.fn<CliDependencies['download']>((_source, { dir }) =>
      Promise.resolve({ dir }),
    );
    // No releases by default, so downloads come from main.
    findLatestRelease = vi.fn<CliDependencies['findLatestRelease']>(() =>
      Promise.resolve(undefined),
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
        findLatestRelease,
        run: okRunner(),
        userAgent: undefined,
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
      expect(output.stdout).toContain('web-dev-starter');
      expect(output.stdout).toContain('next-app');
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
      expect(output.stderr).toContain('next-app');
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
      expect(await run(['my-app', '-t', 'next-app'])).toBe(0);
      expect(download).toHaveBeenCalledWith(
        'gh:eng-enablement-platform/eep-template-next-app',
        expect.anything(),
      );
    });

    it('rejects a GitHub URL and points to giget for other repositories', async () => {
      expect(
        await run(['my-app', '--template', 'https://github.com/org/repo']),
      ).toBe(1);
      expect(output.stderr).toContain('Unknown template');
      expect(output.stderr).toContain('npx giget gh:org/repo my-app');
      expect(download).not.toHaveBeenCalled();
    });

    it('downloads a built-in template from a --ref branch', async () => {
      expect(
        await run(['my-app', '-t', 'next-app', '--ref', 'feat/my-change']),
      ).toBe(0);
      expect(download).toHaveBeenCalledWith(
        'gh:eng-enablement-platform/eep-template-next-app#feat/my-change',
        expect.anything(),
      );
    });

    it("downloads the template's latest release and says which", async () => {
      findLatestRelease.mockResolvedValueOnce('v1.2.0');

      expect(await run(['my-app', '-t', 'next-app'])).toBe(0);
      expect(findLatestRelease).toHaveBeenCalledWith(
        'eng-enablement-platform/eep-template-next-app',
      );
      expect(download).toHaveBeenCalledWith(
        'gh:eng-enablement-platform/eep-template-next-app#v1.2.0',
        expect.anything(),
      );
      expect(output.stdout).toContain(
        'Downloaded the "next-app" template (v1.2.0)',
      );
    });

    it('falls back to main when the template has no releases', async () => {
      expect(await run(['my-app'])).toBe(0);
      expect(output.stdout).toContain('(main - no releases yet)');
    });

    it('uses --ref instead of looking up the latest release', async () => {
      expect(await run(['my-app', '--ref', 'main'])).toBe(0);
      expect(findLatestRelease).not.toHaveBeenCalled();
      expect(download).toHaveBeenCalledWith(
        'gh:eng-enablement-platform/eep-template-web-dev-starter#main',
        expect.anything(),
      );
      expect(output.stdout).toContain('(main)');
    });

    it('stops with a clear error when GitHub cannot be reached for the release lookup', async () => {
      findLatestRelease.mockRejectedValueOnce(new TypeError('fetch failed'));

      expect(await run(['my-app'])).toBe(1);
      expect(output.stderr).toContain("Couldn't reach GitHub");
      expect(download).not.toHaveBeenCalled();
      expect(existsSync(path.join(cwd, 'my-app'))).toBe(false);
    });

    it('rejects an invalid --ref before downloading', async () => {
      expect(await run(['my-app', '--ref', '../oops'])).toBe(1);
      expect(output.stderr).toContain('Invalid --ref "../oops"');
      expect(download).not.toHaveBeenCalled();
    });

    it('explains a failed download in terms of what the user asked for', async () => {
      download.mockRejectedValueOnce(
        new Error(
          'Failed to download https://api.github.com/repos/org/repo/tarball/no-such-branch: 404 Not Found',
        ),
      );

      expect(await run(['my-app', '--ref', 'no-such-branch'])).toBe(1);
      expect(output.stderr).toContain(
        'Couldn\'t find "no-such-branch" in the web-dev-starter template',
      );
      expect(output.stderr).toContain('Details:');
    });

    const downloadTemplateWithManifest = (manifest: string) =>
      download.mockImplementationOnce(fakeTemplateDownload(manifest));

    it('applies the template manifest after downloading', async () => {
      downloadTemplateWithManifest(
        JSON.stringify({ version: 1, readme: 'README.md' }),
      );

      expect(await run(['my-app'])).toBe(0);
      const projectDir = path.join(cwd, 'my-app');
      expect(readFileSync(path.join(projectDir, 'README.md'), 'utf8')).toBe(
        '# my-app',
      );
      expect(existsSync(path.join(projectDir, '.eep'))).toBe(false);
    });

    it('removes the half-made project when the manifest is invalid', async () => {
      downloadTemplateWithManifest(JSON.stringify({ version: 99 }));

      expect(await run(['my-app'])).toBe(1);
      expect(output.stderr).toContain('Unsupported manifest version 99');
      expect(output.stderr).toContain('Nothing was created');
      expect(existsSync(path.join(cwd, 'my-app'))).toBe(false);
    });

    it('uses each optional extra default without prompting', async () => {
      downloadTemplateWithManifest(FEATURES_MANIFEST);

      expect(await run(['my-app'])).toBe(0);
      expect(existsSync(path.join(cwd, 'my-app', 'docs'))).toBe(false);
      expect(existsSync(path.join(cwd, 'my-app', 'diagrams'))).toBe(true);
    });

    it('applies --with and --without over the defaults', async () => {
      downloadTemplateWithManifest(FEATURES_MANIFEST);

      expect(
        await run(['my-app', '--with', 'docs', '--without', 'diagrams']),
      ).toBe(0);
      expect(existsSync(path.join(cwd, 'my-app', 'docs'))).toBe(true);
      expect(existsSync(path.join(cwd, 'my-app', 'diagrams'))).toBe(false);
    });

    it('fails on an unknown extra and removes the half-made project', async () => {
      downloadTemplateWithManifest(FEATURES_MANIFEST);

      expect(await run(['my-app', '--with', 'docz'])).toBe(1);
      expect(output.stderr).toContain('This template offers: docs, diagrams');
      expect(existsSync(path.join(cwd, 'my-app'))).toBe(false);
    });

    it('fails on --with for a template without a manifest', async () => {
      expect(await run(['my-app', '--with', 'docs'])).toBe(1);
      expect(output.stderr).toContain('has no optional extras');
    });
  });

  describe('interactive (terminal)', () => {
    const run = (args: string[], ui: Ui) =>
      runCli(['node', 'create-eep', ...args], {
        cwd,
        download,
        findLatestRelease,
        run: okRunner(),
        userAgent: undefined,
        ui,
        stdout: vi.fn(),
        stderr: vi.fn(),
      });

    it('asks for the name and template when neither is given', async () => {
      const { ui } = createFakeUi({
        projectName: 'my-app',
        template: 'next-app',
      });

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
      const { ui } = createFakeUi({ template: 'web-dev-starter' });

      expect(await run(['my-app'], ui)).toBe(0);
      expect(ui.askProjectName).not.toHaveBeenCalled();
      expect(ui.askTemplate).toHaveBeenCalledOnce();
    });

    it('asks nothing when the name and template are both given', async () => {
      const { ui } = createFakeUi({});

      expect(await run(['my-app', '-t', 'next-app'], ui)).toBe(0);
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
      const { ui } = createFakeUi({
        projectName: 'my-app',
        template: 'web-dev-starter',
      });

      await run([], ui);
      const validate = ui.askProjectName.mock.calls[0]?.[0];

      expect(validate?.('my-app')).toBeUndefined();
      expect(validate?.('My App')).toMatch(/can only contain/);
      expect(validate?.('taken')).toMatch(/already exists/);
    });

    it('asks about each optional extra and applies the answers', async () => {
      download.mockImplementationOnce(fakeTemplateDownload(FEATURES_MANIFEST));
      const { ui } = createFakeUi({
        template: 'next-app',
        confirms: { 'Docs?': true, 'Diagrams?': false },
      });

      expect(await run(['my-app'], ui)).toBe(0);
      expect(ui.confirm).toHaveBeenCalledWith('Docs?', false);
      expect(ui.confirm).toHaveBeenCalledWith('Diagrams?', true);
      expect(existsSync(path.join(cwd, 'my-app', 'docs'))).toBe(true);
      expect(existsSync(path.join(cwd, 'my-app', 'diagrams'))).toBe(false);
    });

    it('only asks about extras not given as flags', async () => {
      download.mockImplementationOnce(fakeTemplateDownload(FEATURES_MANIFEST));
      const { ui } = createFakeUi({
        template: 'next-app',
        confirms: { 'Diagrams?': true },
      });

      expect(await run(['my-app', '--without', 'docs'], ui)).toBe(0);
      expect(ui.confirm).toHaveBeenCalledWith('Diagrams?', true);
      expect(ui.confirm).not.toHaveBeenCalledWith('Docs?', expect.anything());
    });

    it('removes the downloaded project when an extra question is cancelled', async () => {
      download.mockImplementationOnce(fakeTemplateDownload(FEATURES_MANIFEST));
      const { ui } = createFakeUi({
        template: 'next-app',
        confirms: { 'Docs?': CANCELLED },
      });

      expect(await run(['my-app'], ui)).toBe(130);
      expect(ui.cancelled).toHaveBeenCalledOnce();
      expect(existsSync(path.join(cwd, 'my-app'))).toBe(false);
    });

    it('reports a failed download through the task and error output', async () => {
      download.mockRejectedValueOnce(new Error('404 Not Found'));
      const { ui, errors } = createFakeUi({ template: 'web-dev-starter' });

      expect(await run(['my-app'], ui)).toBe(1);
      expect(errors.join()).toContain('404 Not Found');
      expect(ui.success).not.toHaveBeenCalled();
    });
  });
});
