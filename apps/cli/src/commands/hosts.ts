import { Command } from 'commander';
import type { Host, Project } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { formatDate, render, style, table } from '../lib/output';
import { resolveHost } from '../lib/resolve';

export function hostsCommand(): Command {
  const hosts = new Command('hosts').description('The machines your sessions run on');

  hosts.addCommand(
    new Command('list')
      .alias('ls')
      .description('List your hosts')
      .action(async function (this: Command) {
        const context = contextFor(this);
        const list = await context.client.get<Host[]>('/hosts');
        render(context.json, list, () =>
          table(
            list,
            [
              { header: 'ID', value: (host) => host.id },
              { header: 'NAME', value: (host) => host.name },
              {
                header: 'STATUS',
                value: (host) => (host.online ? style.green('online') : style.dim('offline')),
              },
              { header: 'OS', value: (host) => host.os ?? '—' },
              { header: 'SESSIONS', value: (host) => String(host.runningSessionCount) },
              { header: 'LAST SEEN', value: (host) => formatDate(host.lastSeenAt) },
            ],
            'No hosts yet. Pair one from the console (Add host).',
          ),
        );
      }),
  );

  hosts.addCommand(
    new Command('get')
      .description('Show one host')
      .argument('<host>', 'Host name or id')
      .action(async function (this: Command, needle: string) {
        const context = contextFor(this);
        const host = await resolveHost(context.client, needle);
        render(context.json, host, () =>
          [
            `${style.bold(host.name)} ${style.dim(`(${host.id})`)}`,
            `${style.dim('Status:   ')} ${host.online ? 'online' : 'offline'} (${host.status})`,
            `${style.dim('Hostname: ')} ${host.hostname ?? '—'}`,
            `${style.dim('OS:       ')} ${host.os ?? '—'}`,
            `${style.dim('Sessions: ')} ${host.runningSessionCount} running`,
            `${style.dim('Last seen:')} ${formatDate(host.lastSeenAt)}`,
          ].join('\n'),
        );
      }),
  );

  return hosts;
}

export function projectsCommand(): Command {
  const projects = new Command('projects').description(
    'Projects: the repositories, default host and agent sessions start from',
  );

  projects.addCommand(
    new Command('list')
      .alias('ls')
      .description('List projects and their repositories')
      .action(async function (this: Command) {
        const context = contextFor(this);
        const [list, hosts] = await Promise.all([
          context.client.get<Project[]>('/projects'),
          context.client.get<Host[]>('/hosts'),
        ]);
        const hostName = new Map(hosts.map((host) => [host.id, host.name]));
        render(context.json, list, () =>
          table(list, [
            { header: 'ID', value: (project) => project.id },
            { header: 'NAME', value: (project) => project.name },
            {
              header: 'REPOSITORIES',
              value: (project) =>
                project.repositories
                  .map((repository) =>
                    repository.isDefault
                      ? `${repository.repositoryFullName}*`
                      : repository.repositoryFullName,
                  )
                  .join(', ') || '—',
            },
            {
              header: 'HOST',
              value: (project) =>
                project.defaultHostId ? (hostName.get(project.defaultHostId) ?? '—') : '—',
            },
            { header: 'AGENT', value: (project) => project.defaultAgent ?? '—' },
          ]),
        );
      }),
  );

  return projects;
}
