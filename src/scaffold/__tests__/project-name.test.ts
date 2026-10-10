import { describe, expect, it } from 'vitest';

import { validateProjectName } from '../project-name.ts';

describe(validateProjectName, () => {
  it.each(['my-app', 'app2', 'my.app', 'my_app', '~app'])(
    'accepts %s',
    (name) => {
      expect(validateProjectName(name)).toBeUndefined();
    },
  );

  it.each([
    'My-App',
    'my app',
    '.hidden',
    '_private',
    'nested/dir',
    '../escape',
    '',
  ])('rejects %j', (name) => {
    expect(validateProjectName(name)).toMatch(/can only contain/);
  });

  it('rejects names longer than 214 characters', () => {
    expect(validateProjectName('a'.repeat(215))).toMatch(/214 characters/);
  });
});
