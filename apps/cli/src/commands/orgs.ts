import { Command } from 'commander';
import type { Member, Organization, Workspace } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { formatDate, render, style, success, table } from '../lib/output';
import { confirm } from '../lib/prompt';

export function orgsCommand(): Command {
  const orgs = new Command('orgs')
    .alias('organizations')
    .description('Manage organizations, members and invitations');

  orgs.addCommand(
    new Command('list')
      .alias('ls')
      .description('List the organizations you belong to')
      .action(async function (this: Command) {
        const context = contextFor(this);
        const organizations = await context.client.get<Organization[]>('/organizations');

        render(context.json, organizations, () =>
          table(organizations, [
            { header: 'ID', value: (org) => org.id },
            { header: 'NAME', value: (org) => org.name },
            { header: 'SLUG', value: (org) => org.slug },
            { header: 'CREATED', value: (org) => formatDate(org.createdAt) },
          ]),
        );
      }),
  );

  orgs.addCommand(
    new Command('create')
      .description('Create an organization')
      .requiredOption('--name <name>')
      .option('--slug <slug>', 'Derived from the name when omitted')
      .action(async function (this: Command) {
        const options = this.opts<{ name: string; slug?: string }>();
        const context = contextFor(this);
        const org = await context.client.post<Organization>('/organizations', {
          body: options,
        });

        render(context.json, org, () => `${style.green('✓')} Created ${org.name} (${org.slug}).`);
      }),
  );

  orgs.addCommand(
    new Command('delete')
      .description('Delete an organization and everything in it')
      .argument('<id>', 'Organization id')
      .option('-y, --yes', 'Do not ask for confirmation')
      .action(async function (this: Command, id: string) {
        const { yes } = this.opts<{ yes?: boolean }>();
        const context = contextFor(this);

        if (!yes && !(await confirm(`Delete organization ${id}? This cannot be undone.`))) {
          throw new CliError('Cancelled.', ExitCode.OK);
        }

        await context.client.delete(`/organizations/${id}`);
        success(`Deleted ${id}.`);
      }),
  );

  orgs.addCommand(
    new Command('members')
      .description('List an organization’s members')
      .argument('<id>', 'Organization id')
      .action(async function (this: Command, id: string) {
        const context = contextFor(this);
        const members = await context.client.get<Member[]>(`/organizations/${id}/members`);

        render(context.json, members, () =>
          table(members, [
            { header: 'MEMBER ID', value: (member) => member.id },
            { header: 'USER ID', value: (member) => member.userId },
            { header: 'EMAIL', value: (member) => member.user?.email ?? '—' },
            { header: 'ROLE', value: (member) => member.role },
          ]),
        );
      }),
  );

  orgs.addCommand(
    new Command('invite')
      .description('Invite someone to an organization')
      .argument('<id>', 'Organization id')
      .requiredOption('--email <email>')
      .requiredOption('--role <role>', 'owner, admin or member')
      .action(async function (this: Command, id: string) {
        const options = this.opts<{ email: string; role: string }>();
        const context = contextFor(this);
        const invitation = await context.client.post(`/organizations/${id}/invitations`, {
          body: options,
        });

        render(
          context.json,
          invitation,
          () => `${style.green('✓')} Invited ${options.email} as ${options.role}.`,
        );
      }),
  );

  orgs.addCommand(
    new Command('remove-member')
      .description('Remove a member from an organization')
      .argument('<id>', 'Organization id')
      .argument('<memberIdOrEmail>', 'Member id or email address')
      .option('-y, --yes', 'Do not ask for confirmation')
      .action(async function (this: Command, id: string, memberIdOrEmail: string) {
        const { yes } = this.opts<{ yes?: boolean }>();
        const context = contextFor(this);

        if (!yes && !(await confirm(`Remove ${memberIdOrEmail} from ${id}?`))) {
          throw new CliError('Cancelled.', ExitCode.OK);
        }

        await context.client.delete(
          `/organizations/${id}/members/${encodeURIComponent(memberIdOrEmail)}`,
        );
        success(`Removed ${memberIdOrEmail}.`);
      }),
  );

  return orgs;
}

export function workspacesCommand(): Command {
  const workspaces = new Command('workspaces').description('Manage workspaces');

  workspaces.addCommand(
    new Command('list')
      .alias('ls')
      .description('List workspaces in an organization')
      .option('--org <id>', 'Organization id (defaults to your active organization)')
      .action(async function (this: Command) {
        const { org } = this.opts<{ org?: string }>();
        const context = contextFor(this);
        const result = await context.client.get<Workspace[]>('/workspaces', {
          query: { organizationId: org },
        });

        render(context.json, result, () =>
          table(result, [
            { header: 'ID', value: (workspace) => workspace.id },
            { header: 'NAME', value: (workspace) => workspace.name },
            {
              header: 'ORGANIZATION',
              value: (workspace) => workspace.organizationId,
            },
          ]),
        );
      }),
  );

  workspaces.addCommand(
    new Command('create')
      .description('Create a workspace')
      .requiredOption('--name <name>')
      .option('--org <id>', 'Organization id (defaults to your active organization)')
      .action(async function (this: Command) {
        const options = this.opts<{ name: string; org?: string }>();
        const context = contextFor(this);
        const workspace = await context.client.post<Workspace>('/workspaces', {
          body: { name: options.name, organizationId: options.org },
        });

        render(
          context.json,
          workspace,
          () => `${style.green('✓')} Created workspace ${workspace.name}.`,
        );
      }),
  );

  workspaces.addCommand(
    new Command('delete')
      .description('Delete a workspace')
      .argument('<id>', 'Workspace id')
      .option('-y, --yes', 'Do not ask for confirmation')
      .action(async function (this: Command, id: string) {
        const { yes } = this.opts<{ yes?: boolean }>();
        const context = contextFor(this);

        if (!yes && !(await confirm(`Delete workspace ${id}?`))) {
          throw new CliError('Cancelled.', ExitCode.OK);
        }

        await context.client.delete(`/workspaces/${id}`);
        success(`Deleted ${id}.`);
      }),
  );

  return workspaces;
}
