import { randomUUID } from 'node:crypto';
import { CODING_AGENT_IDS, type CodingAgentId } from '@oppenheimer/shared/agents';
import { Command, Option } from 'commander';
import type { Automation, Project } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { formatDate, render, style, success, table } from '../lib/output';
import { confirm } from '../lib/prompt';
import {
  type CheckoutRef,
  pickProjectRepository,
  resolveHost,
  resolveProject,
  resolveRepository,
} from '../lib/resolve';

/** `SCHEDULE_FREQUENCIES` in `@oppenheimer/shared`. */
const FREQUENCIES = ['once', 'hourly', 'daily', 'weekdays', 'weekly', 'monthly'] as const;
type Frequency = (typeof FREQUENCIES)[number];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function automationsCommand(): Command {
  const automations = new Command('automations')
    .alias('auto')
    .description('Automations: a task that starts a session on a schedule');

  automations.addCommand(listCommand());
  automations.addCommand(createCommand());
  automations.addCommand(actionCommand('run', 'Start a run now', 'run'));
  automations.addCommand(actionCommand('pause', 'Pause it: no run starts until resumed', 'pause'));
  automations.addCommand(actionCommand('resume', 'Resume a paused automation', 'resume'));
  automations.addCommand(deleteCommand());

  return automations;
}

function listCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List automations')
    .option('--project <project>', 'Only this project’s (name or id)')
    .action(async function (this: Command) {
      const { project } = this.opts<{ project?: string }>();
      const context = contextFor(this);
      const projectId = project ? (await resolveProject(context.client, project)).id : undefined;
      const list = await context.client.get<Automation[]>('/automations', {
        query: { projectId },
      });
      render(context.json, list, () =>
        table(
          list,
          [
            { header: 'ID', value: (automation) => automation.id },
            { header: 'NAME', value: (automation) => automation.name },
            { header: 'STATUS', value: (automation) => automation.status },
            { header: 'NEXT RUN', value: (automation) => formatDate(automation.nextRunAt) },
            { header: 'RUNS', value: (automation) => String(automation.runCount) },
          ],
          'No automations.',
        ),
      );
    });
}

interface CreateOptions {
  name: string;
  host: string;
  project?: string;
  repo?: string[];
  every: Frequency;
  at: string;
  on?: string;
  day?: string;
  date?: string;
  timezone?: string;
  agent: CodingAgentId;
  paused?: boolean;
}

function createCommand(): Command {
  return new Command('create')
    .description('Create an automation that runs a task on a host on a schedule')
    .argument('<prompt...>', 'The task each run starts with')
    .requiredOption('--name <name>', 'What it is called')
    .requiredOption('--host <host>', 'Host each run starts on (name or id)')
    .option('--project <project>', 'Project to list it under (default: the repository’s)')
    .option('--repo <owner/name...>', 'Repositories each run checks out (default: the project’s)')
    .addOption(
      new Option('--every <frequency>', 'How often').choices(FREQUENCIES).makeOptionMandatory(),
    )
    .option('--at <HH:MM>', 'Time of day (for hourly, only the minutes count)', '09:00')
    .option('--on <days>', 'With --every weekly: days, e.g. mon,thu')
    .option('--day <n>', 'With --every monthly: the day of the month')
    .option('--date <YYYY-MM-DD>', 'With --every once: the date')
    .option('--timezone <zone>', 'IANA time zone (default: this machine’s)')
    .addOption(
      new Option('--agent <agent>', 'Which coding agent')
        .choices(CODING_AGENT_IDS)
        .default('claude-code'),
    )
    .option('--paused', 'Create it paused')
    .action(async function (this: Command, words: string[]) {
      const options = this.opts<CreateOptions>();
      const context = contextFor(this);
      const { client } = context;

      const trigger = scheduleTrigger(options);
      const project = options.project ? await resolveProject(client, options.project) : undefined;
      const repositories = await automationRepositories(client, project, options.repo ?? []);
      const projectId = project?.id ?? repositories.find((ref) => ref.projectId)?.projectId;
      if (!projectId) {
        throw new CliError(
          'An automation is listed under a project: pass --project.',
          ExitCode.USAGE,
          '`opp projects list` shows them.',
        );
      }
      const host = await resolveHost(client, options.host);

      const created = await client.post<Automation>('/automations', {
        body: {
          projectId,
          repositories: repositories.map((ref) => ({
            installationId: ref.installationId,
            githubRepoId: ref.githubRepoId,
          })),
          place: 'host',
          hostId: host.id,
          name: options.name,
          triggers: [trigger],
          prompt: words.join(' '),
          agent: options.agent,
          active: !options.paused,
        },
      });
      render(context.json, created, () =>
        [
          `${style.green('✓')} Created ${style.bold(created.name)} ${style.dim(`(${created.id})`)}.`,
          `${style.dim('Next run:')} ${formatDate(created.nextRunAt)}`,
        ].join('\n'),
      );
    });
}

async function automationRepositories(
  client: Parameters<typeof resolveRepository>[0],
  project: Project | undefined,
  names: readonly string[],
): Promise<CheckoutRef[]> {
  if (names.length === 0) {
    if (!project) {
      throw new CliError(
        'Pass --repo owner/name, or --project for its default one.',
        ExitCode.USAGE,
      );
    }
    return [pickProjectRepository(project)];
  }
  return Promise.all(
    names.map((name) =>
      project?.repositories.some(
        (repository) => repository.repositoryFullName.toLowerCase() === name.toLowerCase(),
      )
        ? pickProjectRepository(project, name)
        : resolveRepository(client, name),
    ),
  );
}

/**
 * The schedule card the flags describe, in the shape `POST /automations`
 * takes: the frequency and only the fields that frequency reads (the API
 * refuses the others rather than ignoring them).
 */
export function scheduleTrigger(options: {
  every: Frequency;
  at: string;
  on?: string;
  day?: string;
  date?: string;
  timezone?: string;
}): Record<string, unknown> {
  const time = /^(\d{1,2}):(\d{2})$/.exec(options.at.trim());
  const hour = time ? Number(time[1]) : Number.NaN;
  const minute = time ? Number(time[2]) : Number.NaN;
  if (!time || hour > 23 || minute > 59) {
    throw new CliError(`--at "${options.at}" is not a time like 09:30.`, ExitCode.USAGE);
  }
  const trigger: Record<string, unknown> = {
    source: 'schedule',
    frequency: options.every,
    hour,
    minute,
    timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (options.every === 'weekly') {
    if (!options.on) throw new CliError('--every weekly needs --on, e.g. mon,thu.', ExitCode.USAGE);
    trigger.days = options.on.split(',').map((day) => {
      const index = WEEKDAYS.indexOf(day.trim().toLowerCase().slice(0, 3));
      if (index < 0) throw new CliError(`"${day}" is not a weekday.`, ExitCode.USAGE);
      return index;
    });
  }
  if (options.every === 'monthly') {
    const day = Number(options.day);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new CliError('--every monthly needs --day, 1 to 31.', ExitCode.USAGE);
    }
    trigger.dayOfMonth = day;
  }
  if (options.every === 'once') {
    if (!options.date || !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      throw new CliError('--every once needs --date YYYY-MM-DD.', ExitCode.USAGE);
    }
    trigger.date = options.date;
  }
  return trigger;
}

function actionCommand(
  name: 'run' | 'pause' | 'resume',
  description: string,
  path: string,
): Command {
  return new Command(name)
    .description(description)
    .argument('<id>', 'Automation id')
    .action(async function (this: Command, id: string) {
      const context = contextFor(this);
      const result = await context.client.post<unknown>(`/automations/${id}/${path}`, {
        headers: name === 'run' ? { 'idempotency-key': randomUUID() } : undefined,
      });
      render(context.json, result ?? { id }, () => {
        const verb = { run: 'Started a run of', pause: 'Paused', resume: 'Resumed' }[name];
        return `${style.green('✓')} ${verb} ${id}.`;
      });
    });
}

function deleteCommand(): Command {
  return new Command('delete')
    .description('Delete an automation; its past runs stay in the log')
    .argument('<id>', 'Automation id')
    .option('-y, --yes', 'Do not ask for confirmation')
    .action(async function (this: Command, id: string) {
      const { yes } = this.opts<{ yes?: boolean }>();
      const context = contextFor(this);
      if (!yes && !(await confirm(`Delete automation ${id}?`))) {
        throw new CliError('Cancelled.', ExitCode.OK);
      }
      await context.client.delete(`/automations/${id}`);
      success(`Deleted ${id}.`);
    });
}
