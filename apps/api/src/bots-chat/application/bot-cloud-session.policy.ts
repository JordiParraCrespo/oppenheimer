import {
  CLOUD_AGENT_PROVIDER_LABELS,
  CLOUD_AGENT_PROVIDERS,
  type CloudAgentProviderId,
  type CreateSessionDto,
  createSessionSchema,
  type StartCloudSessionDto,
  startCloudSessionSchema,
} from '@oppenheimer/shared';
import {
  CODING_AGENTS,
  HOST_CLOUD_AGENT_IDS,
  type HostCloudAgentId,
} from '@oppenheimer/shared/agents';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import {
  clippedTask,
  invalidBodyRefusal,
  pickRepository,
  repositoryOf,
  sessionHostId,
} from '../bot-session-tool.mapper';

/**
 * `start_cloud_session` (`25-bots.md` §4.2), decided in one place: which
 * cloud a call names, whether its fields fit that cloud, the body of the
 * command that starts it, and how the bot is told what came of it. Pure, so
 * the tool only dispatches; a new cloud is a row in `CLOUD_RULES`.
 */

/**
 * The clouds a bot can start a session in: Claude Code's and Codex's, which
 * a host starts with its signed-in CLI (`HOST_CLOUD_AGENT_IDS`), and each
 * vendor the control plane launches on the owner's own key with no host
 * (`CLOUD_AGENT_PROVIDERS`). The same places New session, a task and an
 * automation offer (`product/next-steps/cloud-agents.md`).
 */
export const CLOUD_SESSION_AGENTS = [...HOST_CLOUD_AGENT_IDS, ...CLOUD_AGENT_PROVIDERS] as const;
export type CloudSessionAgent = (typeof CLOUD_SESSION_AGENTS)[number];

/** The input fields only some clouds take. */
const CLOUD_FIELDS = ['host_id', 'codex_environment', 'model'] as const;
type CloudField = (typeof CLOUD_FIELDS)[number];

/** What `start_cloud_session` takes. */
export interface StartCloudSessionInput {
  task: string;
  project_id: string;
  repository?: string;
  name?: string;
  agent?: CloudSessionAgent;
  host_id?: string;
  codex_environment?: string;
  model?: string;
}

/**
 * Each cloud, as the planner and the answers read it: a host's CLI starts
 * it (`cli`, which must be signed in there) or the control plane launches
 * it on the owner's key; what it is called; where its session lives; and
 * which of `CLOUD_FIELDS` it takes.
 */
type CloudRule = { label: string; site: string; fields: readonly CloudField[] } & (
  | { start: 'host'; cli: string }
  | { start: 'launch' }
);

const CLOUD_RULES: Readonly<Record<CloudSessionAgent, CloudRule>> = {
  'claude-code': {
    start: 'host',
    cli: 'claude',
    label: CODING_AGENTS['claude-code'].label,
    site: 'claude.ai',
    fields: ['host_id'],
  },
  codex: {
    start: 'host',
    cli: 'codex',
    label: CODING_AGENTS.codex.label,
    site: 'chatgpt.com/codex',
    fields: ['host_id', 'codex_environment'],
  },
  cursor: {
    start: 'launch',
    label: CLOUD_AGENT_PROVIDER_LABELS.cursor,
    site: 'cursor.com',
    fields: ['model'],
  },
};

/**
 * What a call starts: a session a host starts in its agent's cloud
 * (`CreateSessionCommand` with `cloud`, as the console's cloud place and a
 * `claude-cloud` automation), or one a vendor runs, launched on the owner's
 * key (`StartCloudSessionCommand`, as `POST /sessions/cloud`).
 */
export type CloudSessionPlan =
  | { kind: 'host'; agent: HostCloudAgentId; hostId: string; body: CreateSessionDto }
  | { kind: 'launched'; agent: CloudAgentProviderId; body: StartCloudSessionDto };

/** The cloud a call names: Claude Code's when it names none. */
function cloudAgentOf(input: Pick<StartCloudSessionInput, 'agent'>): CloudSessionAgent {
  return input.agent ?? 'claude-code';
}

function isLaunchedCloud(agent: CloudSessionAgent): agent is CloudAgentProviderId {
  return CLOUD_RULES[agent].start === 'launch';
}

/**
 * How a call becomes the command that starts it, or the sentence that says
 * what to change: a field its cloud does not take, a repository the project
 * does not hold, no host for a cloud a host starts, or a body the sessions'
 * own schema refuses.
 */
export function planCloudSession(
  input: StartCloudSessionInput,
  project: ProjectEntity,
  homeHostId: string | null,
): CloudSessionPlan | { refusal: string } {
  const agent = cloudAgentOf(input);
  const misfit = cloudFieldRefusal(input);
  if (misfit) return { refusal: misfit };
  const checkout = pickRepository(project, input.repository);
  if ('reason' in checkout) return { refusal: checkout.reason };
  const common = { projectId: project.id, name: input.name, prompt: input.task };

  if (isLaunchedCloud(agent)) {
    const parsed = startCloudSessionSchema.safeParse({
      ...common,
      provider: agent,
      checkout,
      ...(input.model === undefined ? {} : { model: input.model }),
    });
    if (!parsed.success) {
      return {
        refusal: invalidBodyRefusal(parsed.error.issues, 'Check the task, name and model.'),
      };
    }
    return { kind: 'launched', agent, body: parsed.data };
  }

  const hostId = sessionHostId(input, project, homeHostId);
  if (!hostId) {
    return {
      refusal: `No host given, and neither the project nor you have a default one. A ${CLOUD_RULES[agent].label} cloud session is started by a host whose ${cliOf(agent)} is signed in: ask which one to use (list_hosts).`,
    };
  }
  const parsed = createSessionSchema.safeParse({
    ...common,
    hostId,
    agent,
    cloud: true,
    checkouts: [checkout],
    ...(input.codex_environment === undefined ? {} : { codexEnvironment: input.codex_environment }),
  });
  if (!parsed.success) {
    return {
      refusal: invalidBodyRefusal(
        parsed.error.issues,
        'Check the task, name and codex_environment.',
      ),
    };
  }
  return { kind: 'host', agent, hostId, body: parsed.data };
}

/**
 * A field the call's cloud does not take, in words that say which clouds
 * do; null when every field fits. Needs nothing but the input, so the card
 * can refuse with it even when the project cannot be read.
 */
export function cloudFieldRefusal(input: StartCloudSessionInput): string | null {
  const agent = cloudAgentOf(input);
  const misplaced = CLOUD_FIELDS.find(
    (field) => input[field] !== undefined && !CLOUD_RULES[agent].fields.includes(field),
  );
  if (!misplaced) return null;
  const takers = CLOUD_SESSION_AGENTS.filter((each) =>
    CLOUD_RULES[each].fields.includes(misplaced),
  );
  return `${misplaced} is only for ${takers.join(' and ')}; leave it out for ${agent}.`;
}

/** The host a call's card names: the one that would start it, none for a launched cloud. */
export function cloudSessionHostId(
  input: StartCloudSessionInput,
  project: ProjectEntity | null,
  homeHostId: string | null,
): string | null {
  return isLaunchedCloud(cloudAgentOf(input)) ? null : sessionHostId(input, project, homeHostId);
}

/**
 * The Needs input card's line: "Start a Claude Code cloud session from
 * build-02 in acme/xrp-mobile: Fix the failing test", or, for a cloud
 * launched on the owner's key, "Start a Cursor cloud session in
 * acme/xrp-mobile, on your Cursor key: …", the task cut to fit.
 */
export function cloudSessionSummary(
  input: StartCloudSessionInput,
  project: ProjectEntity | null,
  hostName: string | null,
): string {
  const agent = cloudAgentOf(input);
  const { label } = CLOUD_RULES[agent];
  const repository = project ? repositoryOf(project, input.repository) : null;
  const where = repository ? ` in ${repository}` : ` in project ${input.project_id}`;
  const task = clippedTask(input.task);
  if (isLaunchedCloud(agent)) {
    const model = input.model ? `, model ${input.model}` : '';
    return `Start a ${label} cloud session${where}, on your ${label} key${model}: ${task}`;
  }
  return `Start a ${label} cloud session from ${hostName ?? 'no host yet'}${where}: ${task}`;
}

/**
 * What the bot is told once the command ran: `session` as it read back
 * after the wait, or null when its host was offline and nothing was waited
 * for.
 */
export function cloudStartAnswer(
  plan: CloudSessionPlan,
  sessionId: string,
  session: WorkSessionEntity | null,
): string {
  const rule = CLOUD_RULES[plan.agent];
  const from =
    plan.kind === 'host' ? ` from host ${plan.hostId}` : ` on the owner's ${rule.label} key`;
  if (!session) {
    return `Created session ${sessionId}${from}, but the host is offline: its ${rule.label} cloud session starts when the host comes back. get_session shows its ${rule.site} link once it has one.`;
  }
  const link = cloudLinkOf(session);
  if (link) {
    return `Started ${rule.label} cloud session ${sessionId}${from}: ${link} It runs at ${rule.site} on its own; give the person that link, and follow it there or with get_session.`;
  }
  if (session.state === 'failed' || session.isResolved) {
    const hint =
      rule.start === 'host'
        ? `; most often the host's ${rule.cli} is not installed or not signed in`
        : '';
    return `Session ${sessionId}${from} could not start its ${rule.label} cloud session (it is ${session.state}). read_session says why${hint}.`;
  }
  return `Session ${sessionId} is starting its ${rule.label} cloud session${from}, which has not named it yet. get_session shows its ${rule.site} link once it has one.`;
}

/**
 * A cloud session's page at its vendor, whichever kind: the id its host
 * reported (claude.ai/code for Claude Code, chatgpt.com/codex for a Codex
 * task, as the console's `cloudUrl`), or the page a launching vendor gave.
 * Null for a host session, and for a cloud session that has none yet.
 */
export function cloudLinkOf(session: WorkSessionEntity): string | null {
  if (session.cloudSessionId) {
    const id = encodeURIComponent(session.cloudSessionId);
    return session.agent === 'codex'
      ? `https://chatgpt.com/codex/tasks/${id}`
      : `https://claude.ai/code/${id}`;
  }
  return session.cloudRun?.url ?? null;
}

/** `get_session`'s line for a session's cloud half; null for a session that runs on its host. */
export function describeCloudSession(session: WorkSessionEntity): string | null {
  if (session.place !== 'cloud') return null;
  const run = session.cloudRun;
  const status = run
    ? ` (${run.status}${run.pullRequestUrl ? `, pull request ${run.pullRequestUrl}` : ''})`
    : '';
  return `- cloud session: ${cloudLinkOf(session) ?? 'no link yet'}${status}`;
}

function cliOf(agent: HostCloudAgentId): string {
  const rule = CLOUD_RULES[agent];
  return rule.start === 'host' ? rule.cli : agent;
}
