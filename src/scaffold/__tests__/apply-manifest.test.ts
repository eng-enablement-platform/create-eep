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

import type { TemplateManifest } from '../../templates/manifest.ts';
import { ManifestError } from '../../templates/manifest.ts';
import { applyManifest, loadManifest } from '../apply-manifest.ts';

// Writes a file (creating parent directories) inside the fixture project.
const write = (projectDir: string, relativePath: string, content: string) => {
  const filePath = path.join(projectDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

describe('applying a template manifest', () => {
  let projectDir: string;
  const exists = (relativePath: string) =>
    existsSync(path.join(projectDir, relativePath));
  const read = (relativePath: string) =>
    readFileSync(path.join(projectDir, relativePath), 'utf8');

  const apply = (manifest: TemplateManifest, choices = {}) =>
    applyManifest({
      projectDir,
      manifest,
      choices,
      projectName: 'my-app',
      templateName: 'next-app',
    });

  beforeEach(() => {
    projectDir = mkdtempSync(path.join(tmpdir(), 'create-eep-manifest-'));
    write(projectDir, 'README.md', '# Template README');
    write(projectDir, 'index.html', '<html></html>');
    write(projectDir, '.eep/template.json', '{}');
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  describe(loadManifest, () => {
    it('returns undefined for a template without a manifest', async () => {
      rmSync(path.join(projectDir, '.eep'), { recursive: true });

      expect(await loadManifest(projectDir)).toBeUndefined();
    });

    it('parses a valid manifest', async () => {
      write(projectDir, '.eep/template.json', JSON.stringify({ version: 1 }));

      expect(await loadManifest(projectDir)).toStrictEqual({
        version: 1,
        remove: [],
        features: [],
      });
    });

    it('throws a ManifestError for an invalid manifest', async () => {
      write(projectDir, '.eep/template.json', JSON.stringify({ version: 99 }));

      await expect(loadManifest(projectDir)).rejects.toThrow(ManifestError);
    });

    it('throws a ManifestError for malformed JSON', async () => {
      write(projectDir, '.eep/template.json', '{ not json');

      await expect(loadManifest(projectDir)).rejects.toThrow(
        /Could not read .eep\/template.json/,
      );
    });
  });

  describe(applyManifest, () => {
    it('removes always-removed paths, writes the starter README and deletes .eep/', async () => {
      write(projectDir, 'CHANGELOG.md', 'template changelog');
      write(
        projectDir,
        '.eep/README.md',
        '# {{projectName}}\n\nBootstrapped from the {{templateName}} template.\n',
      );

      await apply({
        version: 1,
        remove: ['CHANGELOG.md', 'not-there/'],
        readme: 'README.md',
        features: [],
      });

      expect(exists('CHANGELOG.md')).toBe(false);
      expect(exists('.eep')).toBe(false);
      expect(exists('index.html')).toBe(true);
      expect(read('README.md')).toBe(
        '# my-app\n\nBootstrapped from the next-app template.\n',
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

      await apply({ version: 1, remove: [], features: [] });

      expect(read('package.json')).toBe(
        `${JSON.stringify({ name: 'my-app', version: '0.1.0', private: true }, null, 2)}\n`,
      );
    });

    describe('optional features', () => {
      const manifest: TemplateManifest = {
        version: 2,
        remove: [],
        features: [
          {
            id: 'docs',
            prompt: 'Docs?',
            default: false,
            remove: ['docs/'],
            scripts: ['dev:docs', 'build:docs'],
          },
          {
            id: 'diagrams',
            prompt: 'Diagrams?',
            default: true,
            remove: ['diagrams/'],
            scripts: [],
          },
        ],
      };

      beforeEach(() => {
        write(projectDir, 'docs/index.md', 'docs');
        write(projectDir, 'diagrams/main.py', 'diagrams');
        write(
          projectDir,
          'package.json',
          JSON.stringify({
            name: 'next-template',
            scripts: {
              dev: 'next dev',
              'dev:docs': 'cd docs',
              'build:docs': 'x',
            },
          }),
        );
      });

      it('removes the paths and package.json scripts of dropped features only', async () => {
        await apply(manifest, { docs: false, diagrams: true });

        expect(exists('docs')).toBe(false);
        expect(exists('diagrams/main.py')).toBe(true);
        expect(JSON.parse(read('package.json'))).toStrictEqual({
          name: 'my-app',
          scripts: { dev: 'next dev' },
        });
      });

      it('keeps everything for kept features', async () => {
        await apply(manifest, { docs: true, diagrams: true });

        expect(exists('docs/index.md')).toBe(true);
        expect(exists('diagrams/main.py')).toBe(true);
        expect(JSON.parse(read('package.json'))).toHaveProperty(
          ['scripts', 'dev:docs'],
          'cd docs',
        );
      });

      it('treats an undecided feature as dropped (never keeps by accident)', async () => {
        await apply(manifest, {});

        expect(exists('docs')).toBe(false);
        expect(exists('diagrams')).toBe(false);
      });
    });
  });
});
