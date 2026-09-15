import { normalizeScopes, PERMISSION_GROUPS, type Scope, sortScopes } from '@oppenheimer/shared';
import { Command } from 'commander';
import type { ApiToken, CreatedApiToken, PermissionCatalog } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { formatDate, formatList, render, style, success, table } from '../lib/output';
import { confirm } from '../lib/prompt';

export function tokensCommand(): Command {
  const tokens = new Command('tokens').description('Manage scoped API tokens');

  tokens.addCommand(listCommand());
  tokens.addCommand(createCommand());
  tokens.addCommand(revokeCommand());
  tokens.addCommand(permissionsCommand());

  return tokens;
}

function listCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List your API tokens')
    .option('--all', 'Include revoked and expired tokens')
    .action(async function (this: Command) {
      const { all } = this.opts<{ all?: boolean }>();
      const context = contextFor(this);
      const tokens = await context.client.get<ApiToken[]>('/tokens');
      const visible = all ? tokens : tokens.filter((token) => isUsable(token));

      render(context.json, visible, () =>
        table(
          visible,
          [
            { header: 'ID', value: (token) => token.id },
            { header: 'NAME', value: (token) => token.name },
            { header: 'PREFIX', value: (token) => token.prefix },
            {
              header: 'PERMISSIONS',
              value: (token) => formatList(token.scopes),
            },
            { header: 'STATUS', value: (token) => statusOf(token) },
            {
              header: 'LAST USED',
              value: (token) => formatDate(token.lastUsedAt),
            },
          ],
          all
            ? 'You have no API tokens.'
            : 'No active API tokens. Use --all to include revoked ones.',
        ),
      );
    });
}

function createCommand(): Command {
  return new Command('create')
    .description('Mint a new API token')
    .requiredOption('--name <name>', 'What this token is for')
    .requiredOption('--permissions <scopes>', 'Comma-separated scopes, e.g. users:read,roles:write')
    .option('--organizations <ids>', 'Restrict the token to these organization ids')
    .option('--expires-in <days>', 'Expire the token after this many days', Number)
    .option('--allow-ip <cidrs>', 'Only accept the token from these addresses or CIDR blocks')
    .action(async function (this: Command) {
      const options = this.opts<{
        name: string;
        permissions: string;
        organizations?: string;
        expiresIn?: number;
        allowIp?: string;
      }>();
      const context = contextFor(this);

      const { scopes, unknown } = normalizeScopes(options.permissions.split(','));
      if (unknown.length > 0) {
        throw new CliError(
          `Unknown permission${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`,
          ExitCode.USAGE,
          'Run `oppenheimer tokens permissions` to see the catalog.',
        );
      }

      const created = await context.client.post<CreatedApiToken>('/tokens', {
        body: {
          name: options.name,
          scopes: sortScopes(scopes),
          organizationIds: splitList(options.organizations),
          expiresInDays: options.expiresIn ?? null,
          ipAllowlist: splitList(options.allowIp),
        },
      });

      if (context.json) {
        render(true, created, () => '');
        return;
      }

      success(`Created ${style.bold(created.name)}.`);
      process.stdout.write(`\n${created.token}\n\n`);
      process.stdout.write(
        `${style.yellow('This secret is shown once and cannot be retrieved again.')}\n`,
      );
      process.stdout.write(
        `${style.dim('Permissions:')} ${formatList(created.scopes)}\n${style.dim('Organizations:')} ${formatList(
          created.organizationIds,
          'all',
        )}\n${style.dim('Expires:')} ${formatDate(created.expiresAt)}\n`,
      );
    });
}

function revokeCommand(): Command {
  return new Command('revoke')
    .description('Revoke an API token')
    .argument('<id>', 'Token id (see `oppenheimer tokens list`)')
    .option('-y, --yes', 'Do not ask for confirmation')
    .action(async function (this: Command, id: string) {
      const { yes } = this.opts<{ yes?: boolean }>();
      const context = contextFor(this);

      if (!yes && !(await confirm(`Revoke token ${id}? Anything using it stops working.`))) {
        throw new CliError('Cancelled.', ExitCode.OK);
      }

      await context.client.delete(`/tokens/${id}`);
      success(`Revoked ${id}.`);
    });
}

function permissionsCommand(): Command {
  return new Command('permissions')
    .alias('perms')
    .description('Show the permission catalog and which parts you may grant')
    .action(async function (this: Command) {
      const context = contextFor(this);
      const catalog = await context.client
        .get<PermissionCatalog>('/tokens/permissions')
        // Falling back to the built-in catalog keeps the command useful
        // against an older API; only `grantable` is genuinely server-side.
        .catch(() => ({
          groups: [...PERMISSION_GROUPS],
          grantable: [] as Scope[],
        }));

      const grantable = new Set(catalog.grantable);
      const rows = catalog.groups.flatMap((group) =>
        (['read', 'write'] as const).map((level) => ({
          scope: group.levels[level].scope,
          group: group.label,
          level: group.levels[level].label,
          description: group.levels[level].description,
          grantable: grantable.has(group.levels[level].scope),
        })),
      );

      render(context.json, catalog, () =>
        table(rows, [
          {
            header: '',
            value: (row) => (row.grantable ? style.green('✓') : style.dim('·')),
          },
          { header: 'SCOPE', value: (row) => row.scope },
          { header: 'GROUP', value: (row) => `${row.group} — ${row.level}` },
          { header: 'DESCRIPTION', value: (row) => row.description },
        ]),
      );

      process.stdout.write(
        `\n${style.dim('✓ marks the permissions you may put on a token; a token can never exceed its creator.')}\n`,
      );
    });
}

function isUsable(token: ApiToken): boolean {
  if (token.revokedAt) return false;
  return !token.expiresAt || new Date(token.expiresAt).getTime() > Date.now();
}

function statusOf(token: ApiToken): string {
  if (token.revokedAt) return style.red('revoked');
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) {
    return style.yellow('expired');
  }
  return style.green('active');
}

function splitList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export const __testing = { isUsable, splitList };
