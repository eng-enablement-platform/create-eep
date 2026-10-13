export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;

/** A JavaScript package manager create-eep can install with. */
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const isPackageManager = (value: string): value is PackageManager =>
  (PACKAGE_MANAGERS as readonly string[]).includes(value);

/** Why a package manager was chosen - shown to the user. */
export type PackageManagerChoice = {
  name: PackageManager;
  reason: 'template' | 'user' | 'default';
};

/**
 * Picks the package manager to install a project with. The template's
 * `packageManager` field wins (its lockfile was made with it - installing with
 * another would ignore it), then the one the user ran create-eep with, then npm.
 *
 * @param options - The template package.json `packageManager` field (e.g.
 *   `pnpm@11.28.4+sha512...`) and `npm_config_user_agent` (e.g. `pnpm/12.10.1 npm/? node/v24`).
 * @returns The package manager and why it was chosen.
 * @example
 * ```ts
 * choosePackageManager({ packageManagerField: 'pnpm@11.28.4', userAgent: 'npm/11 node/v24' });
 * // { name: 'pnpm', reason: 'template' }
 * ```
 */
export function choosePackageManager(options: {
  packageManagerField: unknown;
  userAgent: string | undefined;
}): PackageManagerChoice {
  if (typeof options.packageManagerField === 'string') {
    const name = options.packageManagerField.split('@')[0] ?? '';
    if (isPackageManager(name)) {
      return { name, reason: 'template' };
    }
  }
  const fromUserAgent = options.userAgent?.split('/')[0] ?? '';
  if (isPackageManager(fromUserAgent)) {
    return { name: fromUserAgent, reason: 'user' };
  }
  return { name: 'npm', reason: 'default' };
}

/**
 * The command to run a package.json script, e.g. for next steps.
 *
 * @param packageManager - The project's package manager.
 * @param script - The script name, e.g. `dev`.
 * @returns e.g. `pnpm dev`, `npm run dev`.
 * @example
 * ```ts
 * runScriptCommand('npm', 'dev'); // 'npm run dev'
 * ```
 */
export function runScriptCommand(
  packageManager: PackageManager,
  script: string,
): string {
  // npm and bun need `run`; pnpm and yarn run scripts directly.
  return packageManager === 'npm' || packageManager === 'bun'
    ? `${packageManager} run ${script}`
    : `${packageManager} ${script}`;
}
