import { Command, CommanderError } from 'commander';

import packageJson from '../../package.json' with { type: 'json' };
import type { Downloader } from '../scaffold/create-project.ts';
import {
  checkDestination,
  createProject,
  CreateProjectError,
} from '../scaffold/create-project.ts';
import { validateProjectName } from '../scaffold/project-name.ts';
import {
  DEFAULT_TEMPLATE_NAME,
  resolveTemplateSource,
  TEMPLATES,
} from '../templates/registry.ts';
import type { Ui } from './ui.ts';
import { CANCELLED } from './ui.ts';

/** Everything the CLI touches outside itself - injected so tests need no real I/O. */
export type CliDependencies = {
  cwd: string;
  download: Downloader;
  ui: Ui;
  /** Commander's own output (`--help`, `--version`, argument errors). */
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

type CliOptions = { template: string; yes?: boolean };

// Exit code for a user cancel (Ctrl+C) - the shell convention for SIGINT.
const CANCELLED_EXIT_CODE = 130;

const templateList = TEMPLATES.map(
  (template) => `  ${template.name.padEnd(6)}${template.description}`,
).join('\n');

/**
 * Runs create-eep: parses arguments, asks for anything missing (in a terminal),
 * validates, and scaffolds the project. Returns an exit code instead of
 * exiting, so it can be tested in-process.
 *
 * @param argv - Full process argv (`process.argv`).
 * @param dependencies - Working directory, downloader, UI and output streams.
 * @returns The process exit code - 0 on success, 1 on failure, 130 on cancel.
 * @example
 * ```ts
 * process.exitCode = await runCli(process.argv, { cwd, download, ui, stdout, stderr });
 * ```
 */
export async function runCli(
  argv: readonly string[],
  dependencies: CliDependencies,
): Promise<number> {
  const { cwd, download, ui, stdout, stderr } = dependencies;

  const program = new Command()
    .name('create-eep')
    .description(
      'Scaffold a new project from an Engineering Enablement Platform (EEP) template.',
    )
    .version(packageJson.version, '-v, --version')
    .argument('[project-name]', 'directory to create the project in')
    .option(
      '-t, --template <name-or-url>',
      'template name, GitHub repo URL or gh:org/repo source',
      DEFAULT_TEMPLATE_NAME,
    )
    .option('-y, --yes', 'skip prompts and use the defaults')
    .addHelpText(
      'after',
      `\nTemplates:\n${templateList}\n\nRun without arguments in a terminal to be asked instead.\n\nExample:\n  npx create-eep@latest my-app --template next`,
    )
    // Throw instead of calling process.exit, and write through the injected streams.
    .exitOverride()
    .configureOutput({ writeOut: stdout, writeErr: stderr });

  try {
    await program.parseAsync([...argv]);
  } catch (error) {
    // --help and --version also "throw" with exit code 0.
    if (error instanceof CommanderError) {
      return error.exitCode;
    }
    throw error;
  }

  const options = program.opts<CliOptions>();
  const canPrompt = ui.interactive && options.yes !== true;
  const templateWasGiven = program.getOptionValueSource('template') === 'cli';

  ui.intro(packageJson.version);

  // ── Project name ─────────────────────────────────────────────────────────
  let projectName = program.args[0];
  if (projectName === undefined) {
    if (!canPrompt) {
      ui.error(
        'Missing project name.\n\nUsage: create-eep <project-name> [--template <name>]',
      );
      return 1;
    }
    const answer = await ui.askProjectName(
      (value) =>
        validateProjectName(value) ?? checkDestination(cwd, value.trim()),
    );
    if (answer === CANCELLED) {
      ui.cancelled();
      return CANCELLED_EXIT_CODE;
    }
    projectName = answer.trim();
  }

  const nameProblem = validateProjectName(projectName);
  if (nameProblem !== undefined) {
    ui.error(`Invalid project name "${projectName}". ${nameProblem}`);
    return 1;
  }

  const destinationProblem = checkDestination(cwd, projectName);
  if (destinationProblem !== undefined) {
    ui.error(destinationProblem);
    return 1;
  }

  // ── Template ─────────────────────────────────────────────────────────────
  let template = options.template;
  if (!templateWasGiven && canPrompt) {
    const answer = await ui.askTemplate(TEMPLATES, DEFAULT_TEMPLATE_NAME);
    if (answer === CANCELLED) {
      ui.cancelled();
      return CANCELLED_EXIT_CODE;
    }
    template = answer;
  }

  const templateSource = resolveTemplateSource(template);
  if (templateSource === undefined) {
    ui.error(
      `Unknown template "${template}".\n\nAvailable templates:\n${templateList}\n\nOr pass a GitHub repo URL.`,
    );
    return 1;
  }

  // ── Scaffold ─────────────────────────────────────────────────────────────
  const task = ui.startTask(`Downloading the "${template}" template`);
  try {
    const dir = await createProject({
      projectName,
      templateSource,
      cwd,
      download,
    });
    task.succeed(`Created ${projectName} at ${dir}`);
    ui.success('Done! Happy building.', [`cd ${projectName}`]);
    return 0;
  } catch (error) {
    if (error instanceof CreateProjectError) {
      task.fail('Download failed');
      ui.error(error.message);
      return 1;
    }
    throw error;
  }
}
