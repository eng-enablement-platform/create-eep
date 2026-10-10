#!/usr/bin/env node
import { isCI } from '@clack/prompts';
import { downloadTemplate } from 'giget';

import { runCli } from './cli/run-cli.ts';
import { createClackUi, createPlainUi } from './cli/ui.ts';

const stdout = (text: string): void => {
  process.stdout.write(text);
};
const stderr = (text: string): void => {
  process.stderr.write(text);
};

// Prompts and animations only in a real terminal; CI and pipes get plain text.
const interactive = process.stdin.isTTY && process.stdout.isTTY && !isCI();

// The bin entry - wiring only. All behaviour lives in runCli so it can be tested.
process.exitCode = await runCli(process.argv, {
  cwd: process.cwd(),
  // registry: false - only ever resolve the sources we pass, never giget's own registry.
  download: (source, { dir }) =>
    downloadTemplate(source, { dir, registry: false }),
  ui: interactive ? createClackUi() : createPlainUi(stdout, stderr),
  stdout,
  stderr,
});
