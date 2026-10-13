import { describe, expect, it } from 'vitest';

import { resolveTemplateSource, TEMPLATES, validateRef } from '../registry.ts';

describe(resolveTemplateSource, () => {
  it.each(TEMPLATES.map((template) => [template.name, template.source]))(
    'resolves the built-in template "%s"',
    (name, source) => {
      expect(resolveTemplateSource(name)).toBe(source);
    },
  );

  it('pins a built-in template to a branch, tag or commit', () => {
    expect(resolveTemplateSource('next-app', 'feat/my-change')).toBe(
      'gh:eng-enablement-platform/eep-template-next-app#feat/my-change',
    );
  });

  it.each([
    'nope',
    'https://github.com/org/repo',
    'gh:org/repo',
    'gh:eng-enablement-platform/eep-template-next-app',
  ])('rejects %s - only built-in template names are accepted', (input) => {
    expect(resolveTemplateSource(input)).toBeUndefined();
  });
});

describe(validateRef, () => {
  it.each(['main', 'feat/my-change', 'v1.2.3', 'a1b2c3d', 'release_2026.10'])(
    'accepts %s',
    (ref) => {
      expect(validateRef(ref)).toBeUndefined();
    },
  );

  it.each(['', '-oops', '../escape', 'a..b', 'has space', 'semi;colon'])(
    'rejects %j',
    (ref) => {
      expect(validateRef(ref)).toMatch(/Ref can only contain/);
    },
  );
});
