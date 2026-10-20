import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** What the fake GitHub serves. */
export type FakeGithubOptions = {
  /** The tag `/releases/latest` redirects to - `undefined` means no releases. */
  latestRelease: string | undefined;
  /** Refs with a downloadable tarball. Each project gets a `VERSION` file holding its ref. */
  refs: string[];
};

/** A running fake GitHub - point `GIGET_GITHUB_URL` at `url`. */
export type FakeGithub = {
  url: string;
  close: () => Promise<void>;
};

/*
 * Writes a small template the way a template repository looks - a manifest
 * that removes a file and swaps in a starter README - and packs it like a
 * GitHub tarball, with everything inside one top-level folder.
 */
const packTemplate = (workDirectory: string, ref: string): Buffer => {
  const root = path.join(workDirectory, `org-repo-${ref.replaceAll('/', '-')}`);
  mkdirSync(path.join(root, '.eep'), { recursive: true });
  writeFileSync(path.join(root, 'index.html'), '<h1>Template</h1>\n');
  writeFileSync(path.join(root, 'VERSION'), ref);
  writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n');
  writeFileSync(path.join(root, 'README.md'), '# Template repository\n');
  writeFileSync(
    path.join(root, '.eep', 'template.json'),
    JSON.stringify({
      version: 1,
      remove: ['CHANGELOG.md'],
      readme: 'README.md',
    }),
  );
  writeFileSync(path.join(root, '.eep', 'README.md'), '# {{projectName}}\n');

  const tarball = path.join(workDirectory, `${path.basename(root)}.tar.gz`);
  execFileSync('tar', [
    '-czf',
    tarball,
    '-C',
    workDirectory,
    path.basename(root),
  ]);
  return readFileSync(tarball);
};

/**
 * Starts a local stand-in for the two GitHub endpoints create-eep uses: the
 * website's `/<repo>/releases/latest` redirect and the API's tarball download.
 *
 * @param options - The latest release and the refs that can be downloaded.
 * @returns The server's base URL and a function to stop it.
 * @example
 * ```ts
 * const github = await startFakeGithub({ latestRelease: 'v1.0.0', refs: ['v1.0.0', 'main'] });
 * ```
 */
export async function startFakeGithub(
  options: FakeGithubOptions,
): Promise<FakeGithub> {
  const workDirectory = mkdtempSync(path.join(tmpdir(), 'create-eep-github-'));
  const tarballs = new Map(
    options.refs.map((ref) => [ref, packTemplate(workDirectory, ref)]),
  );

  const server: Server = createServer((request, response) => {
    const url = request.url ?? '';
    if (url.endsWith('/releases/latest')) {
      const repository = url.slice(0, -'/releases/latest'.length);
      response.writeHead(302, {
        location:
          options.latestRelease === undefined
            ? `${repository}/releases`
            : `${repository}/releases/tag/${options.latestRelease}`,
      });
      response.end();
      return;
    }
    // /repos/<org>/<repo>/tarball/<ref>
    const ref = /^\/repos\/[^/]+\/[^/]+\/tarball\/(.+)$/.exec(url)?.[1];
    const tarball = ref === undefined ? undefined : tarballs.get(ref);
    if (tarball === undefined) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/gzip' });
    response.end(request.method === 'HEAD' ? undefined : tarball);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      rmSync(workDirectory, { recursive: true, force: true });
    },
  };
}
