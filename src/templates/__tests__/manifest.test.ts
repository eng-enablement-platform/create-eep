import { describe, expect, it } from 'vitest';

import {
  isSafeRelativePath,
  ManifestError,
  parseManifest,
  renderPlaceholders,
} from '../manifest.ts';

describe(parseManifest, () => {
  it('accepts a minimal manifest and defaults "remove" to empty', () => {
    expect(parseManifest({ version: 1 })).toStrictEqual({
      version: 1,
      remove: [],
    });
  });

  it('accepts remove paths and a readme', () => {
    expect(
      parseManifest({ version: 1, remove: ['docs/'], readme: 'README.md' }),
    ).toStrictEqual({ version: 1, remove: ['docs/'], readme: 'README.md' });
  });

  it.each([
    ['a non-object', 'nope', /JSON object/],
    ['an array', [], /JSON object/],
    ['a missing version', {}, /Unsupported manifest version/],
    ['a newer version', { version: 2 }, /Unsupported manifest version 2/],
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
