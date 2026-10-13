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

/** A long-running command whose output is shown live (e.g. a dependency install). */
export type LogTask = Task & {
  /** One line of the command's output. */
  log: (line: string) => void;
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
  /** Yes/no question - `initialValue` is pre-selected. */
  confirm: (message: string, initialValue: boolean) => Promise<Answer<boolean>>;
  startTask: (message: string) => Task;
  startLogTask: (title: string) => LogTask;
  /** `notes` are things the user still needs to know or do (e.g. a missing tool). */
  success: (
    message: string,
    nextSteps: readonly string[],
    notes?: readonly string[],
  ) => void;
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
    confirm: async (message, initialValue) => {
      const answer = await prompts.confirm({ message, initialValue });
      return typeof answer === 'symbol' ? CANCELLED : answer;
    },
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
    startLogTask: (title) => {
      // Shows the output in a scrolling window while it runs, then collapses it.
      const log = prompts.taskLog({ title, limit: 8 });
      return {
        log: (line) => {
          log.message(line);
        },
        succeed: (message) => {
          log.success(message);
        },
        // Keep the output on failure - it's what explains the error.
        fail: (message) => {
          log.error(pc.red(message), { showLog: true });
        },
      };
    },
    success: (message, nextSteps, notes = []) => {
      for (const note of notes) {
        prompts.log.warn(note);
      }
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
    confirm: noPrompts,
    startTask: (message) => {
      stdout(`${message}...\n`);
      return {
        succeed: (doneMessage) => {
          stdout(`${doneMessage}\n`);
        },
        fail: () => undefined,
      };
    },
    startLogTask: (title) => {
      stdout(`${title}...\n`);
      return {
        log: (line) => {
          stdout(`  ${line}\n`);
        },
        succeed: (message) => {
          stdout(`${message}\n`);
        },
        fail: (message) => {
          stderr(`${message}\n`);
        },
      };
    },
    success: (message, nextSteps, notes = []) => {
      for (const note of notes) {
        stdout(`Note: ${note}\n`);
      }
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
