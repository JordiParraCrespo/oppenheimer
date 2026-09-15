import { Command } from 'commander';
import type { Paginated, Role } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { render, style, success, table } from '../lib/output';
import { confirm } from '../lib/prompt';

export function rolesCommand(): Command {
  const roles = new Command('roles').description('Manage roles and their permissions');

  roles.addCommand(
    new Command('list')
      .alias('ls')
      .description('List roles')
      .option('--search <text>', 'Match against the role name')
      .option('--page <n>', 'Page number', Number)
      .option('--limit <n>', 'Page size (max 100)', Number)
      .action(async function (this: Command) {
        const options = this.opts<{
          search?: string;
          page?: number;
          limit?: number;
        }>();
        const context = contextFor(this);
        const result = await context.client.get<Paginated<Role>>('/roles', {
          query: options,
        });

        render(context.json, result, () =>
          table(result.data, [
            { header: 'ID', value: (role) => role.id },
            { header: 'NAME', value: (role) => role.name },
            {
              header: 'KIND',
              value: (role) => (role.isSystem ? 'system' : 'custom'),
            },
            {
              header: 'PERMISSIONS',
              value: (role) => String(role.permissions.length),
            },
            { header: 'DESCRIPTION', value: (role) => role.description ?? '—' },
          ]),
        );
      }),
  );

  roles.addCommand(
    new Command('get')
      .description('Show one role and its permission rules')
      .argument('<id>', 'Role id')
      .action(async function (this: Command, id: string) {
        const context = contextFor(this);
        const role = await context.client.get<Role>(`/roles/${id}`);

        render(context.json, role, () =>
          [
            `${style.bold(role.name)} ${style.dim(`(${role.id})`)}`,
            role.description ?? style.dim('No description'),
            '',
            table(role.permissions, [
              { header: 'ACTION', value: (permission) => permission.action },
              { header: 'SUBJECT', value: (permission) => permission.subject },
            ]),
          ].join('\n'),
        );
      }),
  );

  roles.addCommand(
    new Command('create')
      .description('Create a custom role')
      .requiredOption('--name <name>', 'Lowercase name, e.g. support')
      .option('--description <text>')
      .option(
        '--permissions <rules>',
        'Comma-separated action:subject pairs, e.g. read:User,update:Article',
      )
      .action(async function (this: Command) {
        const options = this.opts<{
          name: string;
          description?: string;
          permissions?: string;
        }>();
        const context = contextFor(this);

        const role = await context.client.post<Role>('/roles', {
          body: {
            name: options.name,
            description: options.description,
            permissions: parseRules(options.permissions),
          },
        });

        render(context.json, role, () => `${style.green('✓')} Created role ${role.name}.`);
      }),
  );

  roles.addCommand(
    new Command('set-permissions')
      .description('Replace a role’s permission set')
      .argument('<id>', 'Role id')
      .requiredOption('--permissions <rules>', 'Comma-separated action:subject pairs')
      .action(async function (this: Command, id: string) {
        const { permissions } = this.opts<{ permissions: string }>();
        const context = contextFor(this);

        const role = await context.client.put<Role>(`/roles/${id}/permissions`, {
          body: { permissions: parseRules(permissions) },
        });

        render(
          context.json,
          role,
          () => `${style.green('✓')} ${role.name} now has ${role.permissions.length} rules.`,
        );
      }),
  );

  roles.addCommand(
    new Command('delete')
      .description('Delete a custom role')
      .argument('<id>', 'Role id')
      .option('-y, --yes', 'Do not ask for confirmation')
      .action(async function (this: Command, id: string) {
        const { yes } = this.opts<{ yes?: boolean }>();
        const context = contextFor(this);

        if (!yes && !(await confirm(`Delete role ${id}? Holders lose its permissions.`))) {
          throw new CliError('Cancelled.', ExitCode.OK);
        }

        await context.client.delete(`/roles/${id}`);
        success(`Deleted ${id}.`);
      }),
  );

  roles.addCommand(
    new Command('assign')
      .description('Replace the roles assigned to a user')
      .argument('<userId>', 'User id')
      .requiredOption('--roles <ids>', 'Comma-separated role ids — anything omitted is unassigned')
      .action(async function (this: Command, userId: string) {
        const { roles: roleIds } = this.opts<{ roles: string }>();
        const context = contextFor(this);

        const result = await context.client.put(`/users/${userId}/roles`, {
          body: {
            roleIds: roleIds
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean),
          },
        });

        render(context.json, result, () => `${style.green('✓')} Updated roles for ${userId}.`);
      }),
  );

  return roles;
}

/** Parse `action:subject` pairs into CASL rules. */
export function parseRules(input: string | undefined): { action: string; subject: string }[] {
  if (!input) return [];

  return input
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [action, subject, ...rest] = pair.split(':');
      if (!action || !subject || rest.length > 0) {
        throw new CliError(
          `Could not read permission "${pair}".`,
          ExitCode.USAGE,
          'Use action:subject, e.g. read:User.',
        );
      }
      return { action, subject };
    });
}
