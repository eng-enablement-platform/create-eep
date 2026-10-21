import { describe, expect, it } from 'vitest';

import {
  findTemplate,
  TEMPLATES,
  templateSource,
  validateRef,
} from '../registry.ts';

describe(findTemplate, () => {
  it.each(TEMPLATES.map((template) => [template.name, template.repository]))(
    'finds the built-in template "%s"',
    (name, repository) => {
      expect(findTemplate(name)?.repository).toBe(repository);
    },
  );

  it.each([
    'nope',
    'https://github.com/org/repo',
    'gh:org/repo',
    'gh:eng-enablement-platform/eep-template-next-app',
  ])('rejects %s - only built-in template names are accepted', (input) => {
    expect(findTemplate(input)).toBeUndefined();
  });
});

describe(templateSource, () => {
  it('downloads the default branch without a ref', () => {
    expect(templateSource('org/repo')).toBe('gh:org/repo');
  });

  it('pins a branch, tag or commit', () => {
    expect(templateSource('org/repo', 'feat/my-change')).toBe(
      'gh:org/repo#feat/my-change',
    );
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
