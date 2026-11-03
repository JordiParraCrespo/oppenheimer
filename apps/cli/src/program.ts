import { Command } from 'commander';
import { authCommands } from './commands/auth';
import { automationsCommand } from './commands/automations';
import { botsCommand } from './commands/bots';
import { hostsCommand, projectsCommand } from './commands/hosts';
import { mcpCommand } from './commands/mcp';
import { sessionsCommand } from './commands/sessions';
import { tasksCommand } from './commands/tasks';
import { tokensCommand } from './commands/tokens';

/** Version reported by `--version`; a test pins it to package.json. */
export const VERSION = '0.1.0';

/**
 * Assemble the CLI. Kept separate from the entrypoint so tests can build the
 * program and inspect it without running anything.
 */
export function createProgram(): Command {
  const program = new Command('opp')
    .description('Drive Oppenheimer from the command line: hosts, sessions, automations, bots')
    .version(VERSION)
    .option('--api-url <url>', 'API base URL (overrides the profile)')
    .option('--token <token>', 'API token to use for this invocation')
    .option('--profile <name>', 'Configuration profile to use')
    .option('--json', 'Print raw JSON instead of tables')
    .showHelpAfterError()
    // Report usage mistakes with the documented exit code instead of
    // Commander's default of 1, which scripts cannot distinguish from a
    // genuine failure. `--help` and `--version` still exit 0.
    .exitOverride()
    .addHelpText(
      'after',
      `
Examples:
  $ opp login                                     Sign in and store a scoped token
  $ opp hosts list                                Your machines, and which are online
  $ opp sessions run --host mac-studio \
      --repo acme/app "Run the iOS tests"         Start an agent on another host
  $ opp sessions wait <id>                        Until it is through, or needs you
  $ opp bots chat juno "What failed last night?"  Ask a bot and print its answer
  $ opp mcp install --client claude-code          Connect an agent to this deployment

Environment:
  OPPENHEIMER_API_URL      Default API base URL
  OPPENHEIMER_API_TOKEN    Credential to use, ahead of the stored profile
  OPPENHEIMER_PROFILE      Profile to use
  OPPENHEIMER_CONFIG       Path to the config file
  NO_COLOR           Disable colour output
`,
    );

  for (const command of authCommands()) program.addCommand(command);
  program.addCommand(hostsCommand());
  program.addCommand(projectsCommand());
  program.addCommand(sessionsCommand());
  program.addCommand(automationsCommand());
  program.addCommand(botsCommand());
  program.addCommand(tasksCommand());
  program.addCommand(tokensCommand());
  program.addCommand(mcpCommand());

  // `exitOverride` is per-command, so apply it across the whole tree — the
  // entrypoint then maps Commander's errors onto the documented exit codes.
  applyExitOverride(program);

  return program;
}

function applyExitOverride(command: Command): void {
  command.exitOverride();
  for (const child of command.commands) applyExitOverride(child);
}
