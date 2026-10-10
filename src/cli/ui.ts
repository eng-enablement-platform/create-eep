import * as prompts from '@clack/prompts';
import pc from 'picocolors';

import type { Template } from '../templates/registry.ts';

/** Returned by a prompt when the user cancels (Ctrl+C / Esc). */
export const CANCELLED = Symbol('cancelled');

/** A prompt answer, or {@link CANCELLED}. */
export type Answer<Value> = Value | typeof CANCELLED;

/** Checks an input value - returns a problem to show, or `undefined` when valid. */
export type Validator = (value: string) => string | undefined;

/** A long-running step shown to the user (a spinner in a terminal). */
export type Task = {
  succeed: (message: string) => void;
  fail: (message: string) => void;
};

/**
 * Everything the CLI shows or asks. Injected into `runCli` so tests can drive
 * prompts without a terminal, and so CI gets plain text instead of animations.
 */
export type Ui = {
  /** Whether prompts can be shown - a real terminal, not CI or piped output. */
  interactive: boolean;
  intro: (version: string) => void;
  askProjectName: (validate: Validator) => Promise<Answer<string>>;
  askTemplate: (
    templates: readonly Template[],
    initialValue: string,
  ) => Promise<Answer<string>>;
  startTask: (message: string) => Task;
  success: (message: string, nextSteps: readonly string[]) => void;
  error: (message: string) => void;
  cancelled: () => void;
};

// clack resolves a cancelled prompt to its cancel symbol; any answer we ask for is a string.
const toAnswer = (value: string | symbol): Answer<string> =>
  typeof value === 'symbol' ? CANCELLED : value;

/**
 * Terminal UI with colours, prompts, a download spinner and a next-steps box,
 * built on `@clack/prompts`. picocolors drops colour for `NO_COLOR`.
 *
 * @returns A {@link Ui} for interactive terminals.
 */
export function createClackUi(): Ui {
  return {
    interactive: true,
    intro: (version) => {
      prompts.intro(
        `${pc.bgCyan(pc.black(' create-eep '))} ${pc.dim(`v${version}`)}`,
      );
    },
    askProjectName: async (validate) =>
      toAnswer(
        await prompts.text({
          message: 'Project name?',
          placeholder: 'my-app',
          validate: (value) => validate(value ?? ''),
        }),
      ),
    askTemplate: async (templates, initialValue) =>
      toAnswer(
        await prompts.select({
          message: 'Which template?',
          initialValue,
          options: templates.map((template) => ({
            value: template.name,
            label: pc.bold(template.name),
            hint: template.description,
          })),
        }),
      ),
    startTask: (message) => {
      const spinner = prompts.spinner();
      spinner.start(message);
      return {
        succeed: (doneMessage) => {
          spinner.stop(doneMessage);
        },
        fail: (failMessage) => {
          spinner.error(pc.red(failMessage));
        },
      };
    },
    success: (message, nextSteps) => {
      prompts.note(
        nextSteps.map((step) => pc.cyan(step)).join('\n'),
        'Next steps',
      );
      prompts.outro(pc.green(message));
    },
    error: (message) => {
      prompts.log.error(pc.red(message));
      prompts.outro(pc.red('Nothing was created.'));
    },
    cancelled: () => {
      prompts.cancel('Cancelled - nothing was created.');
    },
  };
}

/**
 * Plain-text UI for CI and piped output - no colours, animations or prompts.
 *
 * @param stdout - Writes normal output.
 * @param stderr - Writes errors.
 * @returns A non-interactive {@link Ui}.
 */
export function createPlainUi(
  stdout: (text: string) => void,
  stderr: (text: string) => void,
): Ui {
  const noPrompts = (): never => {
    throw new Error('Prompts are not available in non-interactive mode.');
  };

  return {
    interactive: false,
    intro: () => undefined,
    askProjectName: noPrompts,
    askTemplate: noPrompts,
    startTask: (message) => {
      stdout(`${message}...\n`);
      return {
        succeed: (doneMessage) => {
          stdout(`${doneMessage}\n`);
        },
        fail: () => undefined,
      };
    },
    success: (message, nextSteps) => {
      stdout(
        `\n${message}\n\nNext steps:\n${nextSteps.map((step) => `  ${step}`).join('\n')}\n`,
      );
    },
    error: (message) => {
      stderr(`Error: ${message}\n`);
    },
    cancelled: () => undefined,
  };
}
