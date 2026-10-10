#!/usr/bin/env node
import { downloadTemplate } from 'giget';

import { runCli } from './cli/run-cli.ts';

// The bin entry - wiring only. All behaviour lives in runCli so it can be tested.
process.exitCode = await runCli(process.argv, {
  cwd: process.cwd(),
  // registry: false - only ever resolve the sources we pass, never giget's own registry.
  download: (source, { dir }) =>
    downloadTemplate(source, { dir, registry: false }),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
