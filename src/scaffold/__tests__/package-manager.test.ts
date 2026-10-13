import { describe, expect, it } from 'vitest';

import { choosePackageManager, runScriptCommand } from '../package-manager.ts';

describe(choosePackageManager, () => {
  it("prefers the template's packageManager field (its lockfile was made with it)", () => {
    expect(
      choosePackageManager({
        packageManagerField: 'pnpm@11.28.4+sha512.abc',
        userAgent: 'npm/11.6.0 node/v24.16.0 darwin arm64',
      }),
    ).toStrictEqual({ name: 'pnpm', reason: 'template' });
  });

  it.each([
    ['npm/11.6.0 node/v24.16.0 darwin arm64', 'npm'],
    ['pnpm/12.10.1 npm/? node/v24.16.0 darwin arm64', 'pnpm'],
    ['yarn/4.5.0 npm/? node/v24.16.0 linux x64', 'yarn'],
    ['bun/1.3.14 npm/? node/v24.3.0 darwin arm64', 'bun'],
  ])(
    'falls back to the package manager the user ran (%s)',
    (userAgent, name) => {
      expect(
        choosePackageManager({ packageManagerField: undefined, userAgent }),
      ).toStrictEqual({ name, reason: 'user' });
    },
  );

  it('ignores an unknown packageManager field', () => {
    expect(
      choosePackageManager({
        packageManagerField: 'deno@2.0.0',
        userAgent: 'pnpm/12.10.1 node/v24',
      }),
    ).toStrictEqual({ name: 'pnpm', reason: 'user' });
  });

  it('defaults to npm when nothing says otherwise', () => {
    expect(
      choosePackageManager({ packageManagerField: 42, userAgent: undefined }),
    ).toStrictEqual({ name: 'npm', reason: 'default' });
  });
});

describe(runScriptCommand, () => {
  it.each([
    ['npm', 'npm run dev'],
    ['bun', 'bun run dev'],
    ['pnpm', 'pnpm dev'],
    ['yarn', 'yarn dev'],
  ] as const)('%s runs a script as "%s"', (packageManager, command) => {
    expect(runScriptCommand(packageManager, 'dev')).toBe(command);
  });
});
