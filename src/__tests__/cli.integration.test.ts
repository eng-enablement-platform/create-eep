import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { FakeGithub } from './fake-github.ts';
import { startFakeGithub } from './fake-github.ts';

/*
 * Runs the built CLI (dist/) as a real process against a fake GitHub, so the
 * whole path is covered - argument parsing, the release lookup, giget's real
 * download and extraction, and the manifest. `pnpm test:integration` builds
 * first.
 */
const BIN = fileURLToPath(new URL('../../dist/index.mjs', import.meta.url));

type RunResult = { exitCode: number; stdout: string; stderr: string };

let cwd: string;
let github: FakeGithub | undefined;

// Async on purpose - a sync spawn would block the fake server in this process.
const runCli = (args: string[], githubUrl: string): Promise<RunResult> =>
  new Promise((resolve) => {
    // No token - the fake GitHub doesn't need one.
    const environment = { ...process.env, GIGET_AUTH: undefined };
    execFile(
      process.execPath,
      [BIN, ...args, '--yes', '--no-install', '--no-git'],
      {
        cwd,
        env: {
          ...environment,
          GIGET_GITHUB_URL: githubUrl,
          // An empty cache, so giget can never fall back to an old download.
          XDG_CACHE_HOME: path.join(cwd, '.cache'),
        },
      },
      (error, stdout, stderr) => {
        resolve({
          exitCode: typeof error?.code === 'number' ? error.code : 0,
          stdout,
          stderr,
        });
      },
    );
  });

const readProjectFile = (...segments: string[]) =>
  readFileSync(path.join(cwd, ...segments), 'utf8');

beforeAll(() => {
  if (!existsSync(BIN)) {
    throw new Error('dist/index.mjs is missing - run `pnpm build` first.');
  }
});

beforeEach(() => {
  cwd = mkdtempSync(path.join(tmpdir(), 'create-eep-integration-'));
});

afterEach(async () => {
  await github?.close();
  github = undefined;
  rmSync(cwd, { recursive: true, force: true });
});

describe('create-eep (built CLI)', () => {
  it("creates a project from the template's latest release", async () => {
    github = await startFakeGithub({
      latestRelease: 'v1.0.0',
      refs: ['v1.0.0', 'main'],
    });

    const result = await runCli(['my-app'], github.url);

    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      'Downloaded the "web-dev-starter" template (v1.0.0)',
    );
    expect(readProjectFile('my-app', 'VERSION')).toBe('v1.0.0');
    // The manifest ran: starter README rendered, listed file and .eep/ removed.
    expect(readProjectFile('my-app', 'README.md')).toBe('# my-app\n');
    expect(existsSync(path.join(cwd, 'my-app', 'CHANGELOG.md'))).toBe(false);
    expect(existsSync(path.join(cwd, 'my-app', '.eep'))).toBe(false);
  });

  it('falls back to main when the template has no releases', async () => {
    github = await startFakeGithub({
      latestRelease: undefined,
      refs: ['main'],
    });

    const result = await runCli(['my-app'], github.url);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('(main - no releases yet)');
    expect(readProjectFile('my-app', 'VERSION')).toBe('main');
  });

  it('uses --ref instead of the latest release', async () => {
    github = await startFakeGithub({
      latestRelease: 'v1.0.0',
      refs: ['v1.0.0', 'feat/change'],
    });

    const result = await runCli(['my-app', '--ref', 'feat/change'], github.url);

    expect(result.exitCode).toBe(0);
    expect(readProjectFile('my-app', 'VERSION')).toBe('feat/change');
  });

  it('explains a --ref that does not exist and leaves nothing behind', async () => {
    github = await startFakeGithub({
      latestRelease: 'v1.0.0',
      refs: ['v1.0.0'],
    });

    const result = await runCli(['my-app', '--ref', 'nope'], github.url);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'Couldn\'t find "nope" in the web-dev-starter template',
    );
    expect(existsSync(path.join(cwd, 'my-app'))).toBe(false);
  });

  it('explains when GitHub cannot be reached', async () => {
    // Start and stop a server to get a port with nothing listening on it.
    const stopped = await startFakeGithub({
      latestRelease: undefined,
      refs: [],
    });
    await stopped.close();

    const result = await runCli(['my-app'], stopped.url);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Couldn't reach GitHub");
    expect(existsSync(path.join(cwd, 'my-app'))).toBe(false);
  });
});
