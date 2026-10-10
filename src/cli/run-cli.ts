import { Command, CommanderError } from 'commander';

import packageJson from '../../package.json' with { type: 'json' };
import type { Downloader } from '../scaffold/create-project.ts';
import {
  createProject,
  CreateProjectError,
} from '../scaffold/create-project.ts';
import { validateProjectName } from '../scaffold/project-name.ts';
import {
  DEFAULT_TEMPLATE_NAME,
  resolveTemplateSource,
  TEMPLATES,
} from '../templates/registry.ts';

/** Everything the CLI touches outside itself - injected so tests need no real I/O. */
export type CliDependencies = {
  cwd: string;
  download: Downloader;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

type CliOptions = { template: string };

const templateList = TEMPLATES.map(
  (template) => `  ${template.name.padEnd(6)}${template.description}`,
).join('\n');

/**
 * Runs create-eep: parses arguments, validates them, and scaffolds the project.
 * Returns an exit code instead of exiting, so it can be tested in-process.
 *
 * @param argv - Full process argv (`process.argv`).
 * @param dependencies - Working directory, downloader and output streams.
 * @returns The process exit code - 0 on success, 1 on any failure.
 * @example
 * ```ts
 * process.exitCode = await runCli(process.argv, { cwd: process.cwd(), download, stdout, stderr });
 * ```
 */
export async function runCli(
  argv: readonly string[],
  dependencies: CliDependencies,
): Promise<number> {
  const { cwd, download, stdout, stderr } = dependencies;

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
    .addHelpText(
      'after',
      `\nTemplates:\n${templateList}\n\nExample:\n  npm create eep@latest my-app -- --template next`,
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

  const projectName = program.args[0];
  const { template } = program.opts<CliOptions>();

  if (projectName === undefined) {
    stderr(
      'Error: missing project name.\n\nUsage: create-eep <project-name> [--template <name>]\n',
    );
    return 1;
  }

  const nameProblem = validateProjectName(projectName);
  if (nameProblem !== undefined) {
    stderr(`Error: invalid project name "${projectName}". ${nameProblem}\n`);
    return 1;
  }

  const templateSource = resolveTemplateSource(template);
  if (templateSource === undefined) {
    stderr(
      `Error: unknown template "${template}".\n\nAvailable templates:\n${templateList}\n\nOr pass a GitHub repo URL.\n`,
    );
    return 1;
  }

  stdout(`Creating ${projectName} from "${template}"...\n`);

  try {
    const dir = await createProject({
      projectName,
      templateSource,
      cwd,
      download,
    });
    stdout(
      `\nDone! Created ${projectName} at ${dir}\n\nNext steps:\n  cd ${projectName}\n`,
    );
    return 0;
  } catch (error) {
    if (error instanceof CreateProjectError) {
      stderr(`Error: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}
