#!/usr/bin/env node
import { CommanderError } from 'commander';
import { CliError, ExitCode } from '../lib/errors';
import { style } from '../lib/output';
import { createProgram } from '../program';

/**
 * Entrypoint. Every failure funnels through here so the CLI reports errors the
 * same way everywhere: a one-line message, an optional next step, and an exit
 * code scripts can branch on.
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    fail(error);
  }
}

function fail(error: unknown): never {
  if (error instanceof CommanderError) {
    // Commander has already printed the message and the help text.
    const informational =
      error.code === 'commander.helpDisplayed' ||
      error.code === 'commander.help' ||
      error.code === 'commander.version';
    process.exit(informational ? ExitCode.OK : ExitCode.USAGE);
  }

  if (error instanceof CliError) {
    // `Cancelled.` and friends are ordinary outcomes, not failures.
    if (error.exitCode === ExitCode.OK) {
      process.stderr.write(`${error.message}\n`);
      process.exit(ExitCode.OK);
    }

    process.stderr.write(`${style.red('✗')} ${error.message}\n`);
    if (error.hint) process.stderr.write(`  ${style.dim(error.hint)}\n`);
    process.exit(error.exitCode);
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${style.red('✗')} ${message}\n`);
  process.exit(ExitCode.FAILURE);
}

main();
