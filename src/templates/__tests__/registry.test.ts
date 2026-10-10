import { describe, expect, it } from 'vitest';

import { resolveTemplateSource, TEMPLATES } from '../registry.ts';

describe(resolveTemplateSource, () => {
  it.each(TEMPLATES.map((template) => [template.name, template.source]))(
    'resolves the built-in template "%s"',
    (name, source) => {
      expect(resolveTemplateSource(name)).toBe(source);
    },
  );

  it.each([
    ['https://github.com/org/repo', 'gh:org/repo'],
    ['https://github.com/org/repo/', 'gh:org/repo'],
    ['https://github.com/org/repo.git', 'gh:org/repo'],
    ['http://www.github.com/org/my.repo', 'gh:org/my.repo'],
  ])('normalises the GitHub URL %s to %s', (input, expected) => {
    expect(resolveTemplateSource(input)).toBe(expected);
  });

  it('passes a gh: source through unchanged', () => {
    expect(resolveTemplateSource('gh:org/repo#main')).toBe('gh:org/repo#main');
  });

  it.each([
    'nope',
    'https://gitlab.com/org/repo',
    'https://github.com/org',
    'https://github.com/org/repo/tree/main',
  ])('returns undefined for unrecognised input %s', (input) => {
    expect(resolveTemplateSource(input)).toBeUndefined();
  });
});
