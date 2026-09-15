import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Command } from 'commander';
import type { CurrentCredential } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { render, style, success, warn } from '../lib/output';

type ClientName = 'claude-code' | 'claude-desktop' | 'cursor' | 'print';

interface McpServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export function mcpCommand(): Command {
  const mcp = new Command('mcp').description(
    'Connect an MCP client to this Oppenheimer deployment',
  );

  mcp.addCommand(installCommand());
  mcp.addCommand(statusCommand());

  return mcp;
}

function installCommand(): Command {
  return new Command('install')
    .description('Register the Oppenheimer MCP server with an MCP client')
    .option(
      '--client <name>',
      'claude-code, claude-desktop, cursor, or print to only show the config',
      'print',
    )
    .option('--name <name>', 'Name for the server entry', 'oppenheimer')
    .option(
      '--server <path>',
      'Path to the MCP server entrypoint (defaults to the one in this repository)',
    )
    .action(async function (this: Command) {
      const options = this.opts<{
        client: ClientName;
        name: string;
        server?: string;
      }>();
      const context = contextFor(this);

      // Confirm the stored credential works before writing it into a config
      // file that something else will read.
      const credential = await context.client.get<CurrentCredential>('/me/credential');

      const entry: McpServerEntry = {
        command: 'node',
        args: [options.server ?? defaultServerPath()],
        env: {
          OPPENHEIMER_API_URL: context.profile.apiUrl,
          OPPENHEIMER_API_TOKEN: context.profile.token ?? '',
        },
      };

      if (options.client === 'print') {
        render(context.json, { mcpServers: { [options.name]: entry } }, () =>
          JSON.stringify({ mcpServers: { [options.name]: entry } }, null, 2),
        );
        return;
      }

      const path = configPathFor(options.client);
      const config = readJson(path);
      const servers = (config.mcpServers ?? {}) as Record<string, unknown>;

      if (servers[options.name]) {
        warn(`Replacing the existing "${options.name}" entry in ${path}.`);
      }

      servers[options.name] = entry;
      config.mcpServers = servers;

      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, {
        mode: 0o600,
      });

      success(`Registered "${options.name}" in ${path}.`);
      process.stdout.write(
        `${style.dim('Acting as:')} ${credential.email}\n${style.dim('Permissions:')} ${
          credential.effectiveScopes.join(', ') || 'none'
        }\n`,
      );
      process.stdout.write(
        `\n${style.dim('The agent will only see tools these permissions cover. To change that, mint a new token and run this again.')}\n`,
      );
    });
}

function statusCommand(): Command {
  return new Command('status')
    .description('Show which tools an agent would get with the current credential')
    .action(async function (this: Command) {
      const context = contextFor(this);
      const credential = await context.client.get<CurrentCredential>('/me/credential');

      render(context.json, credential, () =>
        [
          `${style.dim('Acting as:  ')} ${credential.email}`,
          `${style.dim('Credential: ')} ${credential.kind}`,
          `${style.dim('Permissions:')} ${credential.effectiveScopes.join(', ') || 'none'}`,
        ].join('\n'),
      );
    });
}

/** The MCP server built alongside this CLI in the same repository. */
function defaultServerPath(): string {
  return resolve(__dirname, '../../../mcp/dist/bin/stdio.js');
}

function configPathFor(client: ClientName): string {
  const home = homedir();

  switch (client) {
    case 'claude-code':
      return join(home, '.claude.json');
    case 'cursor':
      return join(home, '.cursor', 'mcp.json');
    case 'claude-desktop':
      if (platform() === 'darwin') {
        return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      }
      if (platform() === 'win32') {
        return join(
          process.env.APPDATA ?? join(home, 'AppData', 'Roaming'),
          'Claude',
          'claude_desktop_config.json',
        );
      }
      return join(home, '.config', 'Claude', 'claude_desktop_config.json');
    default:
      throw new CliError(
        `Unknown client "${client}".`,
        ExitCode.USAGE,
        'Use claude-code, claude-desktop, cursor, or print.',
      );
  }
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    throw new CliError(
      `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.FAILURE,
      'Fix the file by hand, or use --client print and copy the entry in yourself.',
    );
  }
}

export const __testing = { configPathFor };
