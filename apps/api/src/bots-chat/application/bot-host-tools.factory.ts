import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  PAGINATION,
  SESSION_GROUPS,
  SESSION_STATES,
  SESSION_TRANSCRIPT_CURSOR_MAX,
  SESSION_TRANSCRIPT_FROM,
  type SessionGroup,
  type SessionTranscriptPage,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { UpdateHostRunnerCommand } from '../../hosts/commands/update-host-runner/update-host-runner.command';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import { FindHostsQuery } from '../../hosts/queries/find-hosts/find-hosts.query';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { FindProjectsQuery } from '../../projects/queries/find-projects/find-projects.query';
import type {
  SessionEventPage,
  SessionSearchMatch,
} from '../../sessions/database/work-session.repository.port';
import {
  SESSION_SEARCH_HITS_PER_SESSION,
  SESSION_SEARCH_LIMIT_MAX,
} from '../../sessions/domain/session-search.policy';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import type { WorkSessionEventEntity } from '../../sessions/domain/work-session-event.entity';
import {
  FindLatestSessionEventsQuery,
  type LatestSessionEvents,
} from '../../sessions/queries/find-latest-session-events/find-latest-session-events.query';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import { FindSessionEventsQuery } from '../../sessions/queries/find-session-events/find-session-events.query';
import { FindSessionTranscriptQuery } from '../../sessions/queries/find-session-transcript/find-session-transcript.query';
import { FindSessionsQuery } from '../../sessions/queries/find-sessions/find-sessions.query';
import { SearchSessionsQuery } from '../../sessions/queries/search-sessions/search-sessions.query';
import { describeDecision, groupScanOf, SESSION_GROUP_PHRASES } from '../bot-session-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { describeSessionActivity } from '../domain/bot-session-activity.policy';
import {
  SESSION_READ_BUDGET_KEY,
  SESSION_READ_CHARS_PER_TURN,
  sessionReadBudgetSpentRefusal,
  sessionReadCost,
} from '../domain/bot-session-read-budget.policy';
import { describeTranscriptPage } from '../domain/bot-session-transcript.policy';
import { describeSharedFiles } from '../domain/bot-shared-file.policy';
import {
  cut,
  fenceUntrusted,
  formatToolList,
  formatToolTime,
} from '../domain/bot-tool-text.policy';
import { describeCloudSession } from './bot-cloud-session.policy';
import { BotSessionLinkResolver } from './bot-session-link.resolver';
import { describeSessionSearch } from './bot-session-search.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/** A host as `FindHostsQuery` answers it, the part a tool writes. */
interface HostView {
  host: { id: string; name: string; runnerVersion?: string | null };
  online: boolean;
  runningSessions: number;
  inventory: {
    osName: string | null;
    platform: string;
    tools: { name: string; path?: string; required: boolean }[];
  } | null;
  vitals: { lastSeenAt: Date } | null;
}

/** The coding agents a host can start, as the runner probed them. */
const AGENT_COMMANDS: Record<string, string> = { claude: 'Claude Code', codex: 'Codex' };

/** The most sessions one `list_sessions` call returns. */
const SESSIONS_LIMIT_MAX = 25;

/**
 * How many of the newest sessions a `group` filter looks through. The group
 * is derived on read against the clock, so no index holds it (`FindSessionsQuery`).
 */
const GROUP_SCAN = PAGINATION.MAX_LIMIT;

/** The most log entries one `read_session` call reads. */
const ACTIVITY_LIMIT_MAX = 100;

/** The most entries one `read_session_transcript` call reads: a page fits a turn's context. */
const TRANSCRIPT_LIMIT_MAX = 60;

/** A session's project, by id, as the owner sees it; absent when they cannot read it. */
type ProjectNames = ReadonlyMap<string, string>;

/** Each group and what it means, for the tools' descriptions. */
const GROUP_GLOSSARY = SESSION_GROUPS.map(
  (group) => `${group} (${SESSION_GROUP_PHRASES[group]})`,
).join('; ');

/**
 * Hosts and sessions, the reads: what a bot needs to answer "which hosts are
 * online", "what is running" and "how is that session doing". The one write is
 * `update_host_runner`, the console's Update runner, which asks the owner
 * first; starting, typing into and stopping sessions are
 * `BotSessionToolsFactory`'s.
 */
@Injectable()
export class BotHostToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly links: BotSessionLinkResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.listHosts(),
      this.updateHostRunner(),
      this.listSessions(),
      this.getSession(),
      this.showSession(),
      this.readSession(),
      this.readSessionTranscript(),
      this.searchSessions(),
    ];
  }

  private listHosts(): BotToolDefinition {
    return defineBotTool({
      name: 'list_hosts',
      readOnly: true,
      scope: 'hosts:read',
      description: promptText('sessions/tools-host.list-hosts'),
      input: z.object({}),
      run: async (_input, context) => {
        const hosts = await this.queryBus.execute<FindHostsQuery, HostView[]>(
          new FindHostsQuery({ scope: context.owner }),
        );
        return formatToolList(
          'Hosts',
          hosts.map((view) => describeHost(view, context)),
          promptText('sessions/tools-host.list-hosts-hosts-connected-person'),
        );
      },
    });
  }

  private updateHostRunner(): BotToolDefinition {
    return defineBotTool({
      name: 'update_host_runner',
      scope: 'hosts:write',
      asks: true,
      subject: async (input, context) => ({
        kind: 'host',
        key: input.host_id,
        label: await this.hostName(context, input.host_id),
      }),
      description: promptText('sessions/tools-host.update-host-runner'),
      input: z.object({
        host_id: z.uuid().describe(promptText('sessions/tools-host.update-host-runner-host-id')),
      }),
      summarize: async (input, context) =>
        `Update the runner on ${await this.hostName(context, input.host_id)} to the newest release`,
      run: async (input, context) => {
        await this.commandBus.execute(
          new UpdateHostRunnerCommand({ scope: context.owner, hostId: input.host_id }),
        );
        const name = await this.hostName(context, input.host_id);
        return promptText('sessions/tools-host.update-host-runner-asked-runner-update', {
          name,
          hostId: input.host_id,
        });
      },
    });
  }

  private listSessions(): BotToolDefinition {
    return defineBotTool({
      name: 'list_sessions',
      readOnly: true,
      scope: 'sessions:read',
      description: promptText('sessions/tools-host.list-sessions', {
        sessionsLimitMax: String(SESSIONS_LIMIT_MAX),
        groupGlossary: GROUP_GLOSSARY,
      }),
      input: z.object({
        project_id: z
          .uuid()
          .optional()
          .describe(promptText('sessions/tools-host.list-sessions-project-id')),
        host_id: z
          .uuid()
          .optional()
          .describe(promptText('sessions/tools-host.list-sessions-host-id')),
        state: z
          .enum(SESSION_STATES)
          .optional()
          .describe(promptText('sessions/tools-host.list-sessions-state')),
        group: z
          .enum(SESSION_GROUPS)
          .optional()
          .describe(
            promptText('sessions/tools-host.list-sessions-group', {
              groupScan: String(GROUP_SCAN),
            }),
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(SESSIONS_LIMIT_MAX)
          .default(10)
          .describe(
            promptText('sessions/tools-host.list-sessions-limit', {
              sessionsLimitMax: String(SESSIONS_LIMIT_MAX),
            }),
          ),
      }),
      run: async (input, context) => {
        const now = new Date();
        const plan = groupScanOf(input.group, GROUP_SCAN);
        const scanning = plan !== null && 'scan' in plan;
        const [page, projects] = await Promise.all([
          this.queryBus.execute<FindSessionsQuery, { data: WorkSessionEntity[]; total?: number }>(
            new FindSessionsQuery({
              scope: context.owner,
              page: 1,
              limit: scanning ? plan.scan : input.limit,
              projectId: input.project_id,
              hostId: input.host_id,
              state: plan && 'state' in plan ? plan.state : input.state,
            }),
          ),
          this.projectNames(context),
        ]);
        const matching = scanning
          ? page.data.filter((session) => session.group(now) === plan.group)
          : page.data;
        const shown = matching.slice(0, input.limit);
        return formatToolList(
          'Sessions',
          shown.map((session) => describeSession(session, projects, context, now)),
          scanning
            ? promptText('sessions/tools-host.list-sessions-session-among-newest', {
                groupScan: String(GROUP_SCAN),
                group: String(input.group),
              })
            : 'No sessions match.',
          {
            shown: shown.length,
            total: scanning ? matching.length : (page.total ?? page.data.length),
            hint: promptText('sessions/tools-host.list-sessions-hint'),
          },
        );
      },
    });
  }

  private getSession(): BotToolDefinition {
    return defineBotTool({
      name: 'get_session',
      readOnly: true,
      scope: 'sessions:read',
      description: promptText('sessions/tools-host.get-session'),
      input: z.object({
        session_id: z.uuid().describe(promptText('sessions/tools-host.get-session-session-id')),
      }),
      run: async (input, context) => {
        const [session, projects] = await Promise.all([
          this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
            new FindSessionQuery({ scope: context.owner, sessionId: input.session_id }),
          ),
          this.projectNames(context),
        ]);
        const turn = session.latestTurn;
        const group = session.group();
        const lines = [
          `Session ${session.id} "${session.name}"`,
          `- group: ${group} (${SESSION_GROUP_PHRASES[group]})`,
          `- state: ${session.state}`,
          `- project: ${projectLabel(session.projectId, projects)}`,
          `- host: ${session.hostId ?? promptText('sessions/tools-host.get-session-none-runs-vendors')}`,
          `- agent: ${session.agent}`,
          `- started by: ${session.origin}`,
          `- where: ${session.folderPath ? `folder ${session.folderPath}` : `branch ${session.branch ?? 'none yet'}`}`,
          `- last activity: ${formatToolTime(session.lastEventAt, context.timeZone)}`,
          `- stopped: ${session.stoppedAt ? formatToolTime(session.stoppedAt, context.timeZone) : 'no'}`,
          `- link: ${this.links.link(session.id)}`,
        ];
        const cloud = describeCloudSession(session);
        if (cloud) lines.push(cloud);
        if (turn) lines.push(...describeTurn(turn));
        if (session.pendingDecision) {
          lines.push(
            promptText('sessions/tools-host.get-session-what-waits-from', {
              fenceUntrusted: fenceUntrusted(
                'session_output',
                describeDecision(session.pendingDecision).join('\n'),
              ),
            }),
            `  ${promptText('sessions/tools-host.get-session-unblock-answer-session')}`,
          );
        }
        lines.push(...describeSharedFiles(session.sharedFiles));
        return lines.join('\n');
      },
    });
  }

  /**
   * The console's Open session button on the call's line, for a session the
   * bot only found: the chat draws it from the call's session, never from
   * the words, as it does for one `start_session` started. A channel's chat
   * draws no buttons, so there the answer is the link the bot writes.
   */
  private showSession(): BotToolDefinition {
    return defineBotTool({
      name: 'show_session',
      readOnly: true,
      scope: 'sessions:read',
      description: promptText('sessions/tools-host.show-session'),
      input: z.object({
        session_id: z.uuid().describe(promptText('sessions/tools-host.get-session-session-id')),
      }),
      run: async (input, context) => {
        const session = await this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
          new FindSessionQuery({ scope: context.owner, sessionId: input.session_id }),
        );
        const link = this.links.forTurn(context, session.id);
        const content = link
          ? promptText('sessions/tools-host.show-session-channel-content', {
              id: session.id,
              name: session.name,
              link,
            })
          : promptText('sessions/tools-host.show-session-content', {
              id: session.id,
              name: session.name,
            });
        return { content, sessionId: session.id };
      },
    });
  }

  private readSession(): BotToolDefinition {
    return defineBotTool({
      name: 'read_session',
      readOnly: true,
      scope: 'sessions:read',
      description: promptText('sessions/tools-host.read-session', {
        activityLimitMax: String(ACTIVITY_LIMIT_MAX),
      }),
      input: z.object({
        session_id: z.uuid().describe(promptText('sessions/tools-host.get-session-session-id')),
        limit: z.number().int().min(1).max(ACTIVITY_LIMIT_MAX).default(40),
        after_seq: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(promptText('sessions/tools-host.read-session-after-seq')),
      }),
      run: async (input, context) => {
        if (context.budget.overspent(SESSION_READ_BUDGET_KEY, SESSION_READ_CHARS_PER_TURN)) {
          throw new BotToolRefusal(sessionReadBudgetSpentRefusal());
        }
        const { session, events, nextSeq } = await this.activity(context, input);
        const content = this.describeActivity(session, events, nextSeq, input, context.timeZone);
        context.budget.spend(SESSION_READ_BUDGET_KEY, sessionReadCost(content));
        return content;
      },
    });
  }

  private readSessionTranscript(): BotToolDefinition {
    return defineBotTool({
      name: 'read_session_transcript',
      readOnly: true,
      scope: 'sessions:read',
      description: promptText('sessions/tools-host.read-session-transcript', {
        transcriptLimitMax: String(TRANSCRIPT_LIMIT_MAX),
      }),
      input: z.object({
        session_id: z.uuid().describe(promptText('sessions/tools-host.get-session-session-id')),
        limit: z.number().int().min(1).max(TRANSCRIPT_LIMIT_MAX).default(20),
        cursor: z
          .string()
          .min(1)
          .max(SESSION_TRANSCRIPT_CURSOR_MAX)
          .optional()
          .describe(promptText('sessions/tools-host.read-session-transcript-cursor')),
        from: z
          .enum(SESSION_TRANSCRIPT_FROM)
          .default('latest')
          .describe(promptText('sessions/tools-host.read-session-transcript-from')),
      }),
      run: async (input, context) => {
        if (context.budget.overspent(SESSION_READ_BUDGET_KEY, SESSION_READ_CHARS_PER_TURN)) {
          throw new BotToolRefusal(sessionReadBudgetSpentRefusal());
        }
        const [session, page] = await Promise.all([
          this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
            new FindSessionQuery({ scope: context.owner, sessionId: input.session_id }),
          ),
          this.queryBus.execute<FindSessionTranscriptQuery, SessionTranscriptPage>(
            new FindSessionTranscriptQuery({
              scope: context.owner,
              sessionId: input.session_id,
              cursor: input.cursor,
              limit: input.limit,
              from: input.from,
            }),
          ),
        ]);
        const content = describeTranscriptPage(session, page, context.timeZone);
        context.budget.spend(SESSION_READ_BUDGET_KEY, sessionReadCost(content));
        return content;
      },
    });
  }

  private searchSessions(): BotToolDefinition {
    return defineBotTool({
      name: 'search_sessions',
      readOnly: true,
      scope: 'sessions:read',
      description: promptText('sessions/tools-host.search-sessions', {
        sessionSearchHitsPerSession: String(SESSION_SEARCH_HITS_PER_SESSION),
        sessionSearchLimitMax: String(SESSION_SEARCH_LIMIT_MAX),
      }),
      input: z.strictObject({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe(promptText('sessions/tools-host.search-sessions-query')),
        host_id: z
          .uuid()
          .optional()
          .describe(promptText('sessions/tools-host.list-sessions-host-id')),
        project_id: z
          .uuid()
          .optional()
          .describe(promptText('sessions/tools-host.list-sessions-project-id')),
        since: z
          .union([z.iso.date(), z.iso.datetime({ offset: true })])
          .optional()
          .describe(promptText('sessions/tools-host.search-sessions-since')),
        limit: z.number().int().min(1).max(SESSION_SEARCH_LIMIT_MAX).default(10),
      }),
      run: async (input, context) => {
        const [matches, projects, hosts] = await Promise.all([
          this.queryBus.execute<SearchSessionsQuery, SessionSearchMatch[]>(
            new SearchSessionsQuery({
              scope: context.owner,
              query: input.query,
              hostId: input.host_id,
              projectId: input.project_id,
              since: input.since ? new Date(input.since) : undefined,
              limit: input.limit,
            }),
          ),
          this.projectNames(context),
          this.hostNames(context),
        ]);
        return describeSessionSearch({
          query: input.query,
          matches,
          projects,
          hosts,
          timeZone: context.timeZone,
          now: new Date(),
        });
      },
    });
  }

  /** A session's activity page as `read_session` words it for the model. */
  private describeActivity(
    session: WorkSessionEntity,
    events: WorkSessionEventEntity[],
    nextSeq: number | null,
    input: { after_seq?: number },
    timeZone: string,
  ): string {
    const lines = describeSessionActivity(events, timeZone);
    const group = session.group();
    const last = events.at(-1)?.seq ?? input.after_seq ?? null;
    if (!lines.length) {
      return input.after_seq === undefined
        ? promptText('sessions/tools-host.describe-activity-session-has-activity', {
            id: session.id,
            name: session.name,
          })
        : promptText('sessions/tools-host.describe-activity-nothing-new-session', {
            id: session.id,
            name: session.name,
            afterSeq: String(input.after_seq),
            group,
            group2: SESSION_GROUP_PHRASES[group],
          });
    }
    const which =
      input.after_seq === undefined
        ? `Its last ${lines.length} entries`
        : `${lines.length} entries after entry ${input.after_seq}`;
    return [
      promptText('sessions/tools-host.describe-activity-session-now-from', {
        id: session.id,
        name: session.name,
        group,
        group2: SESSION_GROUP_PHRASES[group],
        which,
      }),
      fenceUntrusted('session_activity', lines.join('\n')),
      nextSeq !== null
        ? promptText('sessions/tools-host.describe-activity-more-follows-read', {
            last: String(last),
          })
        : promptText('sessions/tools-host.describe-activity-all-so-far', { last: String(last) }),
    ].join('\n');
  }

  /** The latest entries, or a page after one, with the session they belong to. */
  private async activity(
    context: BotToolCallContext,
    input: { session_id: string; limit: number; after_seq?: number },
  ): Promise<{
    session: WorkSessionEntity;
    events: WorkSessionEventEntity[];
    nextSeq: number | null;
  }> {
    if (input.after_seq === undefined) {
      const latest = await this.queryBus.execute<FindLatestSessionEventsQuery, LatestSessionEvents>(
        new FindLatestSessionEventsQuery({
          scope: context.owner,
          sessionId: input.session_id,
          limit: input.limit,
        }),
      );
      return { ...latest, nextSeq: null };
    }
    const [session, page] = await Promise.all([
      this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
        new FindSessionQuery({ scope: context.owner, sessionId: input.session_id }),
      ),
      this.queryBus.execute<FindSessionEventsQuery, SessionEventPage>(
        new FindSessionEventsQuery({
          scope: context.owner,
          sessionId: input.session_id,
          afterSeq: input.after_seq,
          limit: input.limit,
        }),
      ),
    ]);
    return { session, events: page.events, nextSeq: page.nextSeq };
  }

  /** Every host the owner can read, by id; none when the read fails. */
  private async hostNames(context: BotToolCallContext): Promise<ReadonlyMap<string, string>> {
    const hosts = await this.queryBus
      .execute<FindHostsQuery, HostView[]>(new FindHostsQuery({ scope: context.owner }))
      .catch(() => []);
    return new Map(hosts.map((view) => [view.host.id, view.host.name]));
  }

  /** The host's name as the owner sees it, quoted; its id when they cannot read it. */
  private async hostName(context: BotToolCallContext, hostId: string): Promise<string> {
    const overview = await this.queryBus
      .execute<FindHostQuery, { host: { name: string } }>(
        new FindHostQuery({ scope: context.owner, hostId }),
      )
      .catch(() => null);
    return overview ? `"${overview.host.name}"` : `host ${hostId}`;
  }

  /** Every project the owner can read, archived ones too, by id. */
  private async projectNames(context: BotToolCallContext): Promise<ProjectNames> {
    const projects = await this.queryBus
      .execute<FindProjectsQuery, ProjectEntity[]>(
        new FindProjectsQuery({ scope: context.owner, includeArchived: true }),
      )
      .catch(() => []);
    return new Map(projects.map((project) => [project.id, project.name]));
  }
}

function describeHost(view: HostView, context: BotToolCallContext): string {
  const agents = (view.inventory?.tools ?? [])
    .filter((tool) => tool.path && AGENT_COMMANDS[tool.name])
    .map((tool) => AGENT_COMMANDS[tool.name]);
  const parts = [
    view.online
      ? 'online'
      : `offline, last seen ${formatToolTime(view.vitals?.lastSeenAt, context.timeZone)}`,
    `${view.runningSessions} running`,
    view.inventory?.osName ?? view.inventory?.platform ?? 'unknown system',
    `runner ${view.host.runnerVersion ?? 'version unknown'}`,
    agents.length ? `agents: ${agents.join(', ')}` : 'no coding agent found yet',
  ];
  const home = view.host.id === context.homeHostId ? ' (your home host)' : '';
  return `${view.host.id} "${view.host.name}"${home} [${parts.join('; ')}]`;
}

function describeSession(
  session: WorkSessionEntity,
  projects: ProjectNames,
  context: BotToolCallContext,
  now: Date,
): string {
  const where = session.folderPath
    ? `folder ${session.folderPath}`
    : `branch ${session.branch ?? '-'}`;
  const group: SessionGroup = session.group(now);
  return promptText('sessions/tools-host.describe-session', {
    id: session.id,
    name: session.name,
    group,
    state: session.state,
    projectLabel: projectLabel(session.projectId, projects),
    agent: session.agent,
    hostId: String(session.hostId),
    where,
    formatToolTime: formatToolTime(session.lastEventAt, context.timeZone),
  });
}

/** `"Website" (id)`, or the bare id when the owner cannot read the project. */
function projectLabel(projectId: string, projects: ProjectNames): string {
  const name = projects.get(projectId);
  return name ? `"${name}" (${projectId})` : projectId;
}

function describeTurn(turn: NonNullable<WorkSessionEntity['latestTurn']>): string[] {
  const lines = [`- latest task (${turn.state}): ${cut(turn.prompt ?? '(no prompt)', 300)}`];
  if (turn.result) {
    lines.push(
      promptText('sessions/tools-host.describe-turn', {
        fenceUntrusted: fenceUntrusted('session_output', cut(turn.result, 2_000)),
      }),
    );
  }
  if (turn.failureDetail) lines.push(`- failure: ${cut(turn.failureDetail, 500)}`);
  return lines;
}
