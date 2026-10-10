import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import packageJson from '../../../package.json' with { type: 'json' };
import type { CliDependencies } from '../run-cli.ts';
import { runCli } from '../run-cli.ts';

const run = (args: string[], dependencies: CliDependencies) =>
  runCli(['node', 'create-eep', ...args], dependencies);

describe(runCli, () => {
  let cwd: string;
  let output: { stdout: string; stderr: string };
  let dependencies: CliDependencies;
  let download: ReturnType<typeof vi.fn<CliDependencies['download']>>;

  beforeEach(() => {
    cwd = mkdtempSync(path.join(tmpdir(), 'create-eep-test-'));
    output = { stdout: '', stderr: '' };
    download = vi.fn<CliDependencies['download']>((_source, { dir }) =>
      Promise.resolve({ dir }),
    );
    dependencies = {
      cwd,
      download,
      stdout: (text) => (output.stdout += text),
      stderr: (text) => (output.stderr += text),
    };
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('prints the package version for --version', async () => {
    expect(await run(['--version'], dependencies)).toBe(0);
    expect(output.stdout.trim()).toBe(packageJson.version);
    expect(download).not.toHaveBeenCalled();
  });

  it('lists the built-in templates in --help', async () => {
    expect(await run(['--help'], dependencies)).toBe(0);
    expect(output.stdout).toContain('web');
    expect(output.stdout).toContain('next');
    expect(download).not.toHaveBeenCalled();
  });

  it('fails with usage when the project name is missing', async () => {
    expect(await run([], dependencies)).toBe(1);
    expect(output.stderr).toContain('missing project name');
    expect(download).not.toHaveBeenCalled();
  });

  it('fails on an invalid project name', async () => {
    expect(await run(['My App'], dependencies)).toBe(1);
    expect(output.stderr).toContain('invalid project name');
    expect(download).not.toHaveBeenCalled();
  });

  it('fails on an unknown template and lists the available ones', async () => {
    expect(await run(['my-app', '--template', 'nope'], dependencies)).toBe(1);
    expect(output.stderr).toContain('unknown template "nope"');
    expect(output.stderr).toContain('next');
    expect(download).not.toHaveBeenCalled();
  });

  it('refuses to write into an existing directory', async () => {
    mkdirSync(path.join(cwd, 'my-app'));

    expect(await run(['my-app'], dependencies)).toBe(1);
    expect(output.stderr).toContain('already exists');
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads the default template into <cwd>/<project-name>', async () => {
    expect(await run(['my-app'], dependencies)).toBe(0);
    expect(download).toHaveBeenCalledWith(
      'gh:eng-enablement-platform/eep-template-web-dev-starter',
      { dir: path.join(cwd, 'my-app') },
    );
    expect(output.stdout).toContain('cd my-app');
  });

  it('downloads the chosen built-in template', async () => {
    expect(await run(['my-app', '-t', 'next'], dependencies)).toBe(0);
    expect(download).toHaveBeenCalledWith(
      'gh:eng-enablement-platform/eep-template-next-app',
      expect.anything(),
    );
  });

  it('downloads from a pasted GitHub URL', async () => {
    expect(
      await run(
        ['my-app', '--template', 'https://github.com/org/repo.git'],
        dependencies,
      ),
    ).toBe(0);
    expect(download).toHaveBeenCalledWith('gh:org/repo', expect.anything());
  });

  it('reports a failed download as a friendly error', async () => {
    download.mockRejectedValueOnce(new Error('404 Not Found'));

    expect(await run(['my-app'], dependencies)).toBe(1);
    expect(output.stderr).toContain('Could not download template');
    expect(output.stderr).toContain('404 Not Found');
  });
});
