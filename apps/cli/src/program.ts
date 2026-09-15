import { Command } from 'commander';
import { authCommands } from './commands/auth';
import { mcpCommand } from './commands/mcp';
import { orgsCommand, workspacesCommand } from './commands/orgs';
import { rolesCommand } from './commands/roles';
import { tokensCommand } from './commands/tokens';
import { usersCommand } from './commands/users';

/** Version reported by `--version`; kept in step with the package. */
export const VERSION = '0.1.0';

/**
 * Assemble the CLI. Kept separate from the entrypoint so tests can build the
 * program and inspect it without running anything.
 */
export function createProgram(): Command {
  const program = new Command('oppenheimer')
    .description('Administer a Oppenheimer deployment from the command line')
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
  $ oppenheimer login                                   Sign in and store a scoped token
  $ oppenheimer whoami                                  Show the credential and its permissions
  $ oppenheimer users list --search ada                 Find users
  $ oppenheimer tokens create --name CI \\
      --permissions users:read,roles:read         Mint a narrow token
  $ oppenheimer mcp install --client claude-code        Connect an agent to this deployment

Environment:
  OPPENHEIMER_API_URL      Default API base URL
  OPPENHEIMER_API_TOKEN    Credential to use, ahead of the stored profile
  OPPENHEIMER_PROFILE      Profile to use
  OPPENHEIMER_CONFIG       Path to the config file
  NO_COLOR           Disable colour output
`,
    );

  for (const command of authCommands()) program.addCommand(command);
  program.addCommand(usersCommand());
  program.addCommand(rolesCommand());
  program.addCommand(orgsCommand());
  program.addCommand(workspacesCommand());
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
