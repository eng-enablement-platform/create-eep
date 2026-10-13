import { describe, expect, it } from 'vitest';

import type { TemplateFeature } from '../manifest.ts';
import {
  isSafeRelativePath,
  ManifestError,
  parseManifest,
  renderPlaceholders,
  resolveFeatureFlags,
} from '../manifest.ts';

describe(parseManifest, () => {
  it('accepts a minimal manifest and defaults "remove" to empty', () => {
    expect(parseManifest({ version: 1 })).toStrictEqual({
      version: 1,
      remove: [],
      features: [],
    });
  });

  it('accepts remove paths and a readme', () => {
    expect(
      parseManifest({ version: 1, remove: ['docs/'], readme: 'README.md' }),
    ).toStrictEqual({
      version: 1,
      remove: ['docs/'],
      readme: 'README.md',
      features: [],
    });
  });

  it.each([
    ['a non-object', 'nope', /JSON object/],
    ['an array', [], /JSON object/],
    ['a missing version', {}, /Unsupported manifest version/],
    ['a newer version', { version: 4 }, /Unsupported manifest version 4/],
    [
      'features in a version 1 manifest',
      { version: 1, features: [] },
      /Unknown manifest field\(s\): features/,
    ],
    ['an unknown field (typo)', { version: 1, remvoe: [] }, /remvoe/],
    ['a non-array remove', { version: 1, remove: 'docs/' }, /array of paths/],
    [
      'a non-string remove entry',
      { version: 1, remove: [1] },
      /array of paths/,
    ],
    [
      'a remove path escaping the project',
      { version: 1, remove: ['../outside'] },
      /inside the project: \.\.\/outside/,
    ],
    ['an absolute readme', { version: 1, readme: '/etc/passwd' }, /relative/],
  ])('rejects %s', (_case, content, message) => {
    expect(() => parseManifest(content)).toThrow(ManifestError);
    expect(() => parseManifest(content)).toThrow(message);
  });
});

describe('parseManifest - version 2 features', () => {
  const docs = {
    id: 'docs',
    prompt: 'Include the docs site?',
    default: false,
    remove: ['docs/'],
    scripts: ['dev:docs'],
  };

  it('accepts features and defaults their remove/scripts to empty', () => {
    expect(
      parseManifest({
        version: 2,
        features: [docs, { id: 'extra', prompt: 'Extra?', default: true }],
      }).features,
    ).toStrictEqual([
      docs,
      { id: 'extra', prompt: 'Extra?', default: true, remove: [], scripts: [] },
    ]);
  });

  it.each([
    ['non-array features', { features: 'docs' }, /"features" must be an array/],
    [
      'a non-object feature',
      { features: ['docs'] },
      /features\[0\] must be an object/,
    ],
    [
      'an invalid id',
      { features: [{ ...docs, id: 'Docs Site' }] },
      /lowercase/,
    ],
    [
      'a missing prompt',
      { features: [{ ...docs, prompt: ' ' }] },
      /needs a "prompt"/,
    ],
    [
      'a non-boolean default',
      { features: [{ ...docs, default: 'no' }] },
      /true\/false "default"/,
    ],
    [
      'non-string scripts',
      { features: [{ ...docs, scripts: [1] }] },
      /script names/,
    ],
    [
      'an unsafe feature path',
      { features: [{ ...docs, remove: ['../x'] }] },
      /features.docs.remove/,
    ],
    [
      'an unknown feature field',
      { features: [{ ...docs, colour: 'red' }] },
      /Unknown features\[0\] field\(s\): colour/,
    ],
    [
      'duplicate ids',
      { features: [docs, docs] },
      /"docs" is used more than once/,
    ],
  ])('rejects %s', (_case, fields, message) => {
    expect(() => parseManifest({ version: 2, ...fields })).toThrow(message);
  });
});

describe('parseManifest - version 3 set-up steps', () => {
  const diagrams = {
    id: 'diagrams',
    prompt: 'Diagrams?',
    default: true,
    remove: ['diagrams/'],
  };
  const setup = {
    title: 'Install diagram dependencies',
    command: ['uv', 'sync'],
    cwd: 'diagrams',
    missing: 'Install uv first.',
  };
  const parseSetup = (fields: object) =>
    parseManifest({
      version: 3,
      features: [{ ...diagrams, setup: { ...setup, ...fields } }],
    }).features[0]?.setup;

  it('accepts a set-up step and defaults requires to the command', () => {
    expect(parseSetup({})).toStrictEqual({ ...setup, requires: 'uv' });
  });

  it('defaults cwd to the project root and keeps an explicit requires', () => {
    expect(parseSetup({ cwd: undefined, requires: 'uvx' })).toStrictEqual({
      ...setup,
      cwd: '.',
      requires: 'uvx',
    });
  });

  it.each([
    ['a missing title', { title: '' }, /needs a "title"/],
    ['an empty command', { command: [] }, /non-empty array/],
    ['a string command', { command: 'uv sync' }, /non-empty array/],
    [
      'a missing "missing" message',
      { missing: undefined },
      /needs a "missing" message/,
    ],
    [
      'a cwd outside the project',
      { cwd: '../elsewhere' },
      /must stay inside the project/,
    ],
    [
      'an unknown setup field',
      { shell: true },
      /Unknown features.diagrams.setup field\(s\): shell/,
    ],
  ])('rejects %s', (_case, fields, message) => {
    expect(() => parseSetup(fields)).toThrow(message);
  });

  it('rejects setup in a version 2 manifest (older create-eep would not run it)', () => {
    expect(() =>
      parseManifest({ version: 2, features: [{ ...diagrams, setup }] }),
    ).toThrow(/Unknown features\[0\] field\(s\): setup/);
  });
});

describe(resolveFeatureFlags, () => {
  const feature = (id: string): TemplateFeature => ({
    id,
    prompt: `${id}?`,
    default: true,
    remove: [],
    scripts: [],
  });
  const features = [
    feature('docs'),
    feature('diagrams'),
    feature('devcontainer'),
  ];

  it('leaves every feature undecided without flags', () => {
    expect(
      resolveFeatureFlags(features, { with: [], without: [] }),
    ).toStrictEqual({ choices: {}, undecided: features });
  });

  it('decides flagged features and leaves the rest undecided', () => {
    expect(
      resolveFeatureFlags(features, {
        with: ['docs'],
        without: ['devcontainer'],
      }),
    ).toStrictEqual({
      choices: { docs: true, devcontainer: false },
      undecided: [feature('diagrams')],
    });
  });

  it('rejects an unknown extra and lists the ones on offer', () => {
    expect(() =>
      resolveFeatureFlags(features, { with: ['docz'], without: [] }),
    ).toThrow(
      /Unknown optional extra\(s\): docz. This template offers: docs, diagrams, devcontainer/,
    );
  });

  it('explains when the template has no extras at all', () => {
    expect(() =>
      resolveFeatureFlags([], { with: [], without: ['docs'] }),
    ).toThrow(/has no optional extras/);
  });

  it('rejects the same extra in --with and --without', () => {
    expect(() =>
      resolveFeatureFlags(features, { with: ['docs'], without: ['docs'] }),
    ).toThrow(/Both --with and --without given for: docs/);
  });
});

describe(isSafeRelativePath, () => {
  it.each(['docs', 'docs/', 'a/b/c.md', './docs', 'a/../b'])(
    'allows %s',
    (input) => {
      expect(isSafeRelativePath(input)).toBe(true);
    },
  );

  it.each(['', '.', '..', '../x', 'a/../../x', '/etc', '..\\x'])(
    'rejects %j',
    (input) => {
      expect(isSafeRelativePath(input)).toBe(false);
    },
  );
});

describe(renderPlaceholders, () => {
  it('replaces known placeholders everywhere they appear', () => {
    expect(
      renderPlaceholders(
        '# {{projectName}} - {{projectName}} ({{templateName}})',
        {
          projectName: 'my-app',
          templateName: 'web-dev-starter',
        },
      ),
    ).toBe('# my-app - my-app (web-dev-starter)');
  });

  it('leaves unknown placeholders untouched so they are easy to spot', () => {
    expect(renderPlaceholders('{{nope}}', {})).toBe('{{nope}}');
  });
});
