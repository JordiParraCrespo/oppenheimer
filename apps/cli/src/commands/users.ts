import { Command } from 'commander';
import type { Paginated, User } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { formatDate, render, style, success, table } from '../lib/output';
import { confirm } from '../lib/prompt';

export function usersCommand(): Command {
  const users = new Command('users').description('Manage users');

  users.addCommand(
    new Command('list')
      .alias('ls')
      .description('List users')
      .option('--page <n>', 'Page number', Number)
      .option('--limit <n>', 'Page size (max 100)', Number)
      .option('--search <text>', 'Match against name or email')
      .option('--role <role>', 'Filter by role name')
      .action(async function (this: Command) {
        const options = this.opts<{
          page?: number;
          limit?: number;
          search?: string;
          role?: string;
        }>();
        const context = contextFor(this);
        const result = await context.client.get<Paginated<User>>('/users', {
          query: options,
        });

        render(context.json, result, () =>
          [
            table(result.data, [
              { header: 'ID', value: (user) => user.id },
              { header: 'EMAIL', value: (user) => user.email },
              {
                header: 'NAME',
                value: (user) => `${user.firstName} ${user.lastName}`.trim(),
              },
              { header: 'ROLE', value: (user) => user.role },
              {
                header: 'STATUS',
                value: (user) => (user.isActive ? style.green('active') : style.red('inactive')),
              },
            ]),
            style.dim(
              `\nPage ${result.meta.page} of ${result.meta.totalPages} — ${result.meta.total} users`,
            ),
          ].join('\n'),
        );
      }),
  );

  users.addCommand(
    new Command('get')
      .description('Show one user')
      .argument('<id>', 'User id')
      .action(async function (this: Command, id: string) {
        const context = contextFor(this);
        const user = await context.client.get<User>(`/users/${id}`);

        render(context.json, user, () =>
          [
            `${style.bold(`${user.firstName} ${user.lastName}`.trim())} ${style.dim(`(${user.id})`)}`,
            `${style.dim('Email:    ')} ${user.email}${user.emailVerified ? '' : style.yellow(' (unverified)')}`,
            `${style.dim('Role:     ')} ${user.role}`,
            `${style.dim('Status:   ')} ${user.isActive ? 'active' : 'inactive'}`,
            `${style.dim('Created:  ')} ${formatDate(user.createdAt)}`,
          ].join('\n'),
        );
      }),
  );

  users.addCommand(
    new Command('update')
      .description('Update a user’s profile')
      .argument('<id>', 'User id')
      .option('--first-name <name>')
      .option('--last-name <name>')
      .option('--active <boolean>', 'Set to false to block sign-in')
      .action(async function (this: Command, id: string) {
        const options = this.opts<{
          firstName?: string;
          lastName?: string;
          active?: string;
        }>();
        const context = contextFor(this);

        const body: Record<string, unknown> = {};
        if (options.firstName) body.firstName = options.firstName;
        if (options.lastName) body.lastName = options.lastName;
        if (options.active !== undefined) body.isActive = parseBoolean(options.active);

        if (Object.keys(body).length === 0) {
          throw new CliError('Nothing to update.', ExitCode.USAGE, 'Pass at least one field.');
        }

        const user = await context.client.patch<User>(`/users/${id}`, { body });
        render(context.json, user, () => `${style.green('✓')} Updated ${user.email}.`);
      }),
  );

  users.addCommand(
    new Command('delete')
      .description('Delete a user permanently')
      .argument('<id>', 'User id')
      .option('-y, --yes', 'Do not ask for confirmation')
      .action(async function (this: Command, id: string) {
        const { yes } = this.opts<{ yes?: boolean }>();
        const context = contextFor(this);

        if (!yes && !(await confirm(`Delete user ${id}? This cannot be undone.`))) {
          throw new CliError('Cancelled.', ExitCode.OK);
        }

        await context.client.delete(`/users/${id}`);
        success(`Deleted ${id}.`);
      }),
  );

  return users;
}

function parseBoolean(value: string): boolean {
  if (/^(true|yes|1)$/i.test(value)) return true;
  if (/^(false|no|0)$/i.test(value)) return false;
  throw new CliError(`Expected true or false, got "${value}".`, ExitCode.USAGE);
}
