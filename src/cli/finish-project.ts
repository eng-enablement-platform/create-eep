import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { RunCommand } from '../scaffold/commands.ts';
import { commandExists } from '../scaffold/commands.ts';
import {
  commitAll,
  initRepository,
  isInsideGitRepository,
} from '../scaffold/git.ts';
import type { PackageManager } from '../scaffold/package-manager.ts';
import {
  choosePackageManager,
  runScriptCommand,
} from '../scaffold/package-manager.ts';
import type { Answer, Ui } from './ui.ts';
import { CANCELLED } from './ui.ts';

/** What the project and machine allow - gathered before asking anything. */
type ProjectFacts = {
  canInitGit: boolean;
  /** Why git can't be initialised - shown as a note. */
  gitBlocker?: string;
  /** Present when the project has a package.json. */
  packages?: {
    packageManager: PackageManager;
    packageManagerInstalled: boolean;
    hasDevScript: boolean;
  };
};

/** The user's answers (or flags / defaults). */
export type FinishChoices = { git: boolean; install: boolean };

type FinishContext = {
  projectDir: string;
  projectName: string;
  ui: Ui;
  run: RunCommand;
};

/**
 * Looks at the downloaded project and the machine: is git available and not
 * already in use here, does the project have dependencies, and is the right
 * package manager installed.
 *
 * @param projectDir - The downloaded project.
 * @param run - The command runner.
 * @param userAgent - `npm_config_user_agent` - which package manager ran create-eep.
 * @returns What can be offered.
 * @example
 * ```ts
 * const facts = await inspectProject(projectDir, runCommand, process.env.npm_config_user_agent);
 * ```
 */
export async function inspectProject(
  projectDir: string,
  run: RunCommand,
  userAgent: string | undefined,
): Promise<ProjectFacts> {
  let canInitGit = false;
  let gitBlocker: string | undefined;
  if (!(await commandExists('git', run))) {
    gitBlocker = "git isn't installed, so no repository was initialised.";
  } else if (await isInsideGitRepository(projectDir, run)) {
    gitBlocker =
      'The project was created inside an existing git repository, so a new one was not initialised.';
  } else {
    canInitGit = true;
  }

  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return { canInitGit, ...(gitBlocker === undefined ? {} : { gitBlocker }) };
  }
  const packageJson = JSON.parse(
    await readFile(packageJsonPath, 'utf8'),
  ) as Record<string, unknown>;
  const { name: packageManager } = choosePackageManager({
    packageManagerField: packageJson.packageManager,
    userAgent,
  });
  const scripts = packageJson.scripts;
  return {
    canInitGit,
    ...(gitBlocker === undefined ? {} : { gitBlocker }),
    packages: {
      packageManager,
      packageManagerInstalled: await commandExists(packageManager, run),
      hasDevScript:
        typeof scripts === 'object' && scripts !== null && 'dev' in scripts,
    },
  };
}

/**
 * Decides whether to initialise git and install dependencies: a flag wins,
 * otherwise ask in a terminal, otherwise use the default (yes) - the same
 * answer the prompt pre-selects.
 *
 * @param facts - From {@link inspectProject}.
 * @param flags - `--git` / `--no-git` and `--install` / `--no-install` (undefined when not given).
 * @param ui - Asks the questions.
 * @param canPrompt - Whether questions can be asked (a terminal, no `--yes`).
 * @returns The choices, or {@link CANCELLED}.
 * @example
 * ```ts
 * const choices = await askFinishChoices(facts, { git: undefined, install: false }, ui, true);
 * ```
 */
export async function askFinishChoices(
  facts: ProjectFacts,
  flags: { git: boolean | undefined; install: boolean | undefined },
  ui: Ui,
  canPrompt: boolean,
): Promise<Answer<FinishChoices>> {
  const decide = async (
    available: boolean,
    flag: boolean | undefined,
    question: string,
  ): Promise<Answer<boolean>> => {
    if (!available) return false;
    if (flag !== undefined) return flag;
    return canPrompt ? ui.confirm(question, true) : true;
  };

  const git = await decide(
    facts.canInitGit,
    flags.git,
    'Initialise a git repository?',
  );
  if (git === CANCELLED) return CANCELLED;

  const install = await decide(
    facts.packages?.packageManagerInstalled === true,
    flags.install,
    `Install dependencies with ${facts.packages?.packageManager ?? 'npm'}?`,
  );
  if (install === CANCELLED) return CANCELLED;

  return { git, install };
}

/**
 * Runs the chosen steps - git init, dependency install, first commit - and
 * works out the next steps and notes to show. Never throws for a failed step:
 * the project is still valid, so failures become notes, not errors.
 *
 * Order matters: git init runs before the install so `prepare` scripts that
 * set up git hooks (e.g. Husky) find a repository; the commit runs last so it
 * includes any lockfile changes from the install.
 *
 * @param facts - From {@link inspectProject}.
 * @param choices - From {@link askFinishChoices}.
 * @param flags - The raw flags, so a note isn't shown for something the user switched off.
 * @param context - Project directory and name, UI and command runner.
 * @returns Next steps and notes for the final summary.
 * @example
 * ```ts
 * const { nextSteps, notes } = await finishProject(facts, choices, flags, { projectDir, projectName, ui, run });
 * ```
 */
export async function finishProject(
  facts: ProjectFacts,
  choices: FinishChoices,
  flags: { git: boolean | undefined; install: boolean | undefined },
  { projectDir, projectName, ui, run }: FinishContext,
): Promise<{ nextSteps: string[]; notes: string[] }> {
  const notes: string[] = [];
  if (facts.gitBlocker !== undefined && flags.git !== false) {
    notes.push(facts.gitBlocker);
  }

  let gitInitialised = false;
  if (choices.git) {
    gitInitialised = await initRepository(projectDir, run);
    if (!gitInitialised) {
      notes.push('`git init` failed, so no repository was initialised.');
    }
  }

  const packages = facts.packages;
  let installed = false;
  if (packages !== undefined) {
    const { packageManager } = packages;
    if (!packages.packageManagerInstalled && flags.install !== false) {
      notes.push(
        `This template uses ${packageManager}, which isn't installed. Install it (e.g. \`npm install -g ${packageManager}\`), then run \`${packageManager} install\`.`,
      );
    } else if (choices.install) {
      const task = ui.startLogTask(
        `Installing dependencies with ${packageManager}`,
      );
      const { exitCode } = await run(packageManager, ['install'], {
        cwd: projectDir,
        onLine: task.log,
      });
      installed = exitCode === 0;
      if (installed) {
        task.succeed('Dependencies installed');
      } else {
        task.fail('Installing dependencies failed');
        notes.push(
          `Installing dependencies failed - run \`${packageManager} install\` in ${projectName} to see why.`,
        );
      }
    }
  }

  if (gitInitialised) {
    const commit = await commitAll(projectDir, run);
    if (!commit.committed) {
      notes.push(
        commit.reason === 'no-identity'
          ? 'git has no user name or email set, so the initial commit was skipped. Set them with `git config --global user.name "Your Name"` and `git config --global user.email you@example.com`, then commit.'
          : 'The initial commit failed - run `git commit` in the project to see why.',
      );
    }
  }

  const nextSteps = [`cd ${projectName}`];
  if (packages !== undefined) {
    if (!installed) nextSteps.push(`${packages.packageManager} install`);
    if (packages.hasDevScript) {
      nextSteps.push(runScriptCommand(packages.packageManager, 'dev'));
    }
  }
  return { nextSteps, notes };
}
