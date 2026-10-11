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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ManifestError } from '../../templates/manifest.ts';
import { applyManifest } from '../apply-manifest.ts';

// Writes a file (creating parent directories) inside the fixture project.
const write = (projectDir: string, relativePath: string, content: string) => {
  const filePath = path.join(projectDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

describe(applyManifest, () => {
  let projectDir: string;
  const apply = () =>
    applyManifest({
      projectDir,
      projectName: 'my-app',
      templateName: 'web-dev-starter',
    });

  beforeEach(() => {
    projectDir = mkdtempSync(path.join(tmpdir(), 'create-eep-manifest-'));
    write(projectDir, 'README.md', '# Template README');
    write(projectDir, 'index.html', '<html></html>');
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('leaves a template without a manifest untouched', async () => {
    expect(await apply()).toBe(false);
    expect(readFileSync(path.join(projectDir, 'README.md'), 'utf8')).toBe(
      '# Template README',
    );
  });

  it('applies the manifest and removes .eep/', async () => {
    write(projectDir, 'docs/index.md', 'template docs');
    write(projectDir, 'CHANGELOG.md', 'template changelog');
    write(
      projectDir,
      '.eep/template.json',
      JSON.stringify({
        version: 1,
        remove: ['docs/', 'CHANGELOG.md', 'not-there/'],
        readme: 'README.md',
      }),
    );
    write(
      projectDir,
      '.eep/README.md',
      '# {{projectName}}\n\nBootstrapped from the {{templateName}} template.\n',
    );

    expect(await apply()).toBe(true);
    expect(existsSync(path.join(projectDir, 'docs'))).toBe(false);
    expect(existsSync(path.join(projectDir, 'CHANGELOG.md'))).toBe(false);
    expect(existsSync(path.join(projectDir, '.eep'))).toBe(false);
    expect(existsSync(path.join(projectDir, 'index.html'))).toBe(true);
    expect(readFileSync(path.join(projectDir, 'README.md'), 'utf8')).toBe(
      '# my-app\n\nBootstrapped from the web-dev-starter template.\n',
    );
  });

  it('sets the package.json name and keeps every other field in order', async () => {
    write(
      projectDir,
      'package.json',
      JSON.stringify({
        name: 'next-template',
        version: '0.1.0',
        private: true,
      }),
    );
    write(projectDir, '.eep/template.json', JSON.stringify({ version: 1 }));

    await apply();

    expect(readFileSync(path.join(projectDir, 'package.json'), 'utf8')).toBe(
      `${JSON.stringify({ name: 'my-app', version: '0.1.0', private: true }, null, 2)}\n`,
    );
  });

  it('throws a ManifestError for an invalid manifest', async () => {
    write(projectDir, '.eep/template.json', JSON.stringify({ version: 99 }));

    await expect(apply()).rejects.toThrow(ManifestError);
  });

  it('throws a ManifestError for malformed JSON', async () => {
    write(projectDir, '.eep/template.json', '{ not json');

    await expect(apply()).rejects.toThrow(/Could not read .eep\/template.json/);
  });
});
