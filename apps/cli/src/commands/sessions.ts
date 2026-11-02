import { randomUUID } from 'node:crypto';
import { Command, Option } from 'commander';
import type { Host, Project, Session, SessionPage } from '../lib/api-types';
import type { ApiClient } from '../lib/client';
import { contextFor } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { formatDate, render, style, success, table, warn } from '../lib/output';
import { confirm } from '../lib/prompt';
import {
  type CheckoutRef,
  pickByNameOrId,
  pickProjectRepository,
  resolveHost,
  resolveProject,
  resolveRepository,
} from '../lib/resolve';
import { parseDuration, waitForSessions } from '../lib/wait';

/** The coding agents a host launches (`CODING_AGENT_IDS` in `@oppenheimer/shared`). */
const AGENTS = ['claude-code', 'codex', 'opencode', 'grok', 'shell'] as const;
const PERMISSIONS = ['ask', 'auto', 'full'] as const;

export function sessionsCommand(): Command {
  const sessions = new Command('sessions')
    .alias('s')
    .description('Start, prompt, wait on and close sessions on your hosts');

  sessions.addCommand(listCommand());
  sessions.addCommand(getCommand());
  sessions.addCommand(runCommand());
  sessions.addCommand(sendCommand());
  sessions.addCommand(waitCommand());
  sessions.addCommand(stopCommand());
  sessions.addCommand(closeCommand());

  return sessions;
}

function listCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List sessions, most recent first')
    .option('--host <host>', 'Only sessions on this host (name or id)')
    .option('--project <project>', 'Only sessions in this project (name or id)')
    .option('--all', 'Include closed sessions')
    .option('--limit <n>', 'How many to show', (value) => Number(value), 25)
    .action(async function (this: Command) {
      const options = this.opts<{
        host?: string;
        project?: string;
        all?: boolean;
        limit: number;
      }>();
      const context = contextFor(this);
      const { client } = context;
      const [hosts, project] = await Promise.all([
        client.get<Host[]>('/hosts'),
        options.project ? resolveProject(client, options.project) : undefined,
      ]);
      const host = options.host
        ? pickByNameOrId(hosts, options.host, 'host', 'opp hosts list')
        : undefined;
      const page = await client.get<SessionPage>('/sessions', {
        query: {
          hostId: host?.id,
          projectId: project?.id,
          state: options.all ? undefined : 'open',
          limit: options.limit,
          sort: 'recent',
        },
      });
      const hostName = new Map(hosts.map((candidate) => [candidate.id, candidate.name]));

      render(context.json, page.data, () =>
        table(
          page.data,
          [
            { header: 'ID', value: (session) => session.id },
            { header: 'NAME', value: (session) => session.name },
            { header: 'STATE', value: (session) => stateLabel(session) },
            { header: 'AGENT', value: (session) => session.agent },
            {
              header: 'HOST',
              value: (session) => (session.hostId ? (hostName.get(session.hostId) ?? '—') : '—'),
            },
            { header: 'REPOSITORY', value: (session) => repositoryOf(session) },
            { header: 'ACTIVE', value: (session) => formatDate(session.lastEventAt) },
          ],
          options.all ? 'No sessions.' : 'No open sessions. Use --all to include closed ones.',
        ),
      );
    });
}

function getCommand(): Command {
  return new Command('get')
    .description('Show one session: its state, and what its agent last said or waits on')
    .argument('<id>', 'Session id')
    .action(async function (this: Command, id: string) {
      const context = contextFor(this);
      const session = await context.client.get<Session>(`/sessions/${id}`);
      render(context.json, session, () => describe(session));
    });
}

function runCommand(): Command {
  return new Command('run')
    .description('Start a coding agent on a host with a task')
    .argument('<task...>', 'The first prompt: what the agent should do')
    .option('--host <host>', 'Host to run on, by name or id (default: the project’s default host)')
    .option('--repo <owner/name>', 'Repository to check out (default: the project’s default one)')
    .option('--project <project>', 'Project to list the session under, by name or id')
    .option('--base <branch>', 'Branch to cut the session’s branch from')
    .option('--folder <path>', 'Run in a folder already on the host instead of a checkout')
    .addOption(new Option('--agent <agent>', 'Which coding agent').choices(AGENTS))
    .addOption(
      new Option('--permission <level>', 'What the agent may do without asking').choices(
        PERMISSIONS,
      ),
    )
    .option('--model <model>', 'Model id or alias the agent’s CLI takes')
    .option('--name <name>', 'Name for the session')
    .option('--wait', 'Wait until the agent is through, or needs you')
    .option('--timeout <duration>', 'With --wait, how long to wait', '30m')
    .action(async function (this: Command, words: string[]) {
      const options = this.opts<RunOptions>();
      const context = contextFor(this);
      const plan = await planRun(context.client, options);

      const created = await context.client.post<Session>('/sessions', {
        // A retry after a lost answer finds the session already made instead of
        // making a second one, with a second branch.
        headers: { 'idempotency-key': randomUUID() },
        body: {
          hostId: plan.host.id,
          agent: options.agent ?? plan.project?.defaultAgent ?? 'claude-code',
          projectId: plan.projectId,
          name: options.name,
          prompt: words.join(' '),
          ...(options.folder
            ? { folder: options.folder }
            : {
                checkouts: [
                  {
                    installationId: plan.checkout?.installationId,
                    githubRepoId: plan.checkout?.githubRepoId,
                    baseBranch: plan.checkout?.baseBranch,
                  },
                ],
                cwdGithubRepoId: plan.checkout?.githubRepoId,
              }),
          ...(options.permission || options.model
            ? { launch: { permission: options.permission, model: options.model } }
            : {}),
        },
      });

      if (!options.wait) {
        render(context.json, created, () => {
          const where = options.folder ?? plan.checkout?.fullName ?? '';
          const offline = created.hints.includes('host_offline')
            ? `\n${style.yellow('!')} ${plan.host.name} is offline: the session starts when it comes back.`
            : '';
          return `${style.green('✓')} Started ${style.bold(created.id)} on ${plan.host.name} (${where}).${offline}\n${style.dim(`opp sessions wait ${created.id}`)}`;
        });
        return;
      }

      await waitAndReport(context.client, [created.id], options.timeout, context.json);
    });
}

interface RunOptions {
  host?: string;
  repo?: string;
  project?: string;
  base?: string;
  folder?: string;
  agent?: (typeof AGENTS)[number];
  permission?: (typeof PERMISSIONS)[number];
  model?: string;
  name?: string;
  wait?: boolean;
  timeout: string;
}

/** The host, project and checkout a `run` names, resolved to ids. */
async function planRun(
  client: ApiClient,
  options: RunOptions,
): Promise<{ host: Host; project?: Project; projectId?: string; checkout?: CheckoutRef }> {
  if (options.folder && options.repo) {
    throw new CliError('Pass --folder or --repo, not both.', ExitCode.USAGE);
  }
  const project = options.project ? await resolveProject(client, options.project) : undefined;

  let checkout: CheckoutRef | undefined;
  if (!options.folder) {
    if (project && (!options.repo || hasRepository(project, options.repo))) {
      checkout = pickProjectRepository(project, options.repo);
      if (options.base) checkout = { ...checkout, baseBranch: options.base };
    } else if (options.repo) {
      checkout = await resolveRepository(client, options.repo, options.base);
    } else {
      throw new CliError(
        'Say where the agent works: --repo owner/name, --project, or --folder.',
        ExitCode.USAGE,
      );
    }
  }

  const hostNeedle = options.host ?? project?.defaultHostId ?? undefined;
  if (!hostNeedle) {
    throw new CliError(
      'Say which host to run on: --host <name>.',
      ExitCode.USAGE,
      '`opp hosts list` shows your hosts.',
    );
  }
  const host = await resolveHost(client, hostNeedle);
  if (!host.online) warn(`${host.name} is offline; the session will start when it comes back.`);

  return { host, project, projectId: project?.id ?? checkout?.projectId, checkout };
}

function hasRepository(project: Project, fullName: string): boolean {
  return project.repositories.some(
    (repository) => repository.repositoryFullName.toLowerCase() === fullName.toLowerCase(),
  );
}

function sendCommand(): Command {
  return new Command('send')
    .description('Send a follow-up prompt to a session’s agent while it waits at its prompt')
    .argument('<id>', 'Session id')
    .argument('<text...>', 'What to tell the agent')
    .option('--wait', 'Wait until the agent is through with it, or needs you')
    .option('--timeout <duration>', 'With --wait, how long to wait', '30m')
    .action(async function (this: Command, id: string, words: string[]) {
      const options = this.opts<{ wait?: boolean; timeout: string }>();
      const context = contextFor(this);
      const session = await context.client.post<Session>(`/sessions/${id}/prompt`, {
        body: { text: words.join(' ') },
      });
      if (!options.wait) {
        render(context.json, session, () => `${style.green('✓')} Sent to ${session.name}.`);
        return;
      }
      await waitAndReport(context.client, [id], options.timeout, context.json);
    });
}

function waitCommand(): Command {
  return new Command('wait')
    .description('Wait until sessions are through with their task, or need you')
    .argument('<ids...>', 'Session ids')
    .option('--timeout <duration>', 'How long to wait; the sessions keep running past it', '30m')
    .action(async function (this: Command, ids: string[]) {
      const { timeout } = this.opts<{ timeout: string }>();
      const context = contextFor(this);
      await waitAndReport(context.client, ids, timeout, context.json);
    });
}

function stopCommand(): Command {
  return new Command('stop')
    .description('Stop a session’s agent, keeping its worktree and branch')
    .argument('<id>', 'Session id')
    .action(async function (this: Command, id: string) {
      const context = contextFor(this);
      const session = await context.client.post<Session>(`/sessions/${id}/stop`);
      render(context.json, session, () => `${style.green('✓')} Stopped ${session.name}.`);
    });
}

function closeCommand(): Command {
  return new Command('close')
    .description('Close a session: end its terminal and remove its worktree')
    .argument('<id>', 'Session id')
    .option('--accept-unpushed', 'Close even if the branch has work that was never pushed')
    .option('-y, --yes', 'Do not ask for confirmation')
    .action(async function (this: Command, id: string) {
      const options = this.opts<{ acceptUnpushed?: boolean; yes?: boolean }>();
      const context = contextFor(this);
      if (!options.yes && !(await confirm(`Close session ${id}? Its terminal ends.`))) {
        throw new CliError('Cancelled.', ExitCode.OK);
      }
      const session = await context.client.delete<Session>(`/sessions/${id}`, {
        query: { acceptUnpushedWork: options.acceptUnpushed ? true : undefined },
      });
      if (session.lifecycle === 'resolved') {
        success(`Closed ${session.name}.`);
      } else {
        warn(`Asked ${session.name} to close; the host has not confirmed yet.`);
      }
    });
}

/** Wait, print where each session ended up, and fail the command on a timeout. */
async function waitAndReport(
  client: ApiClient,
  ids: readonly string[],
  timeout: string,
  json: boolean,
): Promise<void> {
  let timeoutMs: number;
  try {
    timeoutMs = parseDuration(timeout);
  } catch (error) {
    throw new CliError((error as Error).message, ExitCode.USAGE);
  }
  const { settled, sessions } = await waitForSessions(client, ids, {
    timeoutMs,
    intervalMs: 3_000,
  });
  render(json, sessions, () => sessions.map(describe).join('\n\n'));
  if (!settled) {
    throw new CliError(
      `Still working after ${timeout}.`,
      ExitCode.FAILURE,
      'The sessions keep running; wait again, or check on them with `opp sessions get`.',
    );
  }
}

/** A session as a few lines a person reads at a glance. */
export function describe(session: Session): string {
  const lines = [
    `${style.bold(session.name)} ${style.dim(`(${session.id})`)}`,
    `${style.dim('State:  ')} ${stateLabel(session)}`,
    `${style.dim('Agent:  ')} ${session.agent}`,
    `${style.dim('Where:  ')} ${repositoryOf(session)}`,
  ];
  if (session.decision?.kind === 'permission') {
    lines.push(`${style.yellow('Waits on a permission:')} ${session.decision.title}`);
  } else if (session.decision?.kind === 'question') {
    const asked = session.decision.questions.map((question) => question.question).join(' / ');
    lines.push(`${style.yellow('Asks:')} ${asked}`);
  }
  const report = session.agentReport;
  if (report?.message || report?.title) {
    lines.push(
      `${style.dim('Says:   ')} ${[report.title, report.message].filter(Boolean).join(' — ')}`,
    );
  }
  return lines.join('\n');
}

function stateLabel(session: Pick<Session, 'state' | 'lifecycle'>): string {
  if (session.lifecycle === 'starting') return style.cyan('starting');
  if (session.lifecycle === 'failed') return style.red('failed');
  switch (session.state) {
    case 'working':
      return style.cyan('working');
    case 'waiting-on-you':
      return style.yellow('waiting on you');
    case 'ready-for-review':
      return style.green('ready for review');
    default:
      return session.state;
  }
}

function repositoryOf(session: Session): string {
  if (session.checkouts.length > 0) {
    return session.checkouts
      .map((checkout) => `${checkout.repositoryFullName}@${checkout.branch}`)
      .join(', ');
  }
  return session.place === 'cloud' ? 'cloud' : 'folder';
}
