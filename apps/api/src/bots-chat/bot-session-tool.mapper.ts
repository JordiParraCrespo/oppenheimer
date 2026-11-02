import {
  type AnswerSessionDecisionDto,
  CLOUD_AGENT_PROVIDER_LABELS,
  CLOUD_AGENT_PROVIDERS,
  type CloudAgentProviderId,
  type CreateSessionDto,
  createSessionSchema,
  type SessionDecision,
  type SessionGroup,
  type StartCloudSessionDto,
  startCloudSessionSchema,
} from '@oppenheimer/shared';
import {
  CODING_AGENT_IDS,
  CODING_AGENTS,
  type CodingAgentId,
  HOST_CLOUD_AGENT_IDS,
  type HostCloudAgentId,
} from '@oppenheimer/shared/agents';
import type { ProjectEntity } from '../projects/domain/project.entity';
import { isLiveTurn, type SessionTurnFold } from '../sessions/domain/session-turn.policy';
import type { SessionWaitView } from './domain/bot-session-wait.policy';
import { cut } from './domain/bot-tool-text.policy';

/**
 * How `start_session`'s input becomes a session to create (`25-bots.md`
 * §4.2): the host (the one named, the project's default, the bot's home
 * host), the repository (the one named, or the project's default) or a folder,
 * and the body the sessions' own schema accepts; or, when one is missing or
 * wrong, the sentence that tells the model what to ask. Pure.
 */
export interface StartSessionInput {
  task: string;
  project_id?: string;
  repository?: string;
  folder?: string;
  host_id?: string;
  agent?: CodingAgentId;
  name?: string;
  /** Subscribe the bot to it (`27-bot-subscriptions.md` §3); true when omitted. */
  watch?: boolean;
}

/**
 * The level every session a bot starts runs at. Nobody sits at a bot's
 * terminal, so the API's own default (`ask`) would leave the agent waiting on
 * its first approval forever; `auto` lets it work while still checking each
 * action, and the runner marks its folder trusted for the same reason. An
 * agent with no approvals records no level whatever is sent.
 */
export const BOT_SESSION_PERMISSION = 'auto' as const;

export function planSession(
  input: StartSessionInput,
  project: ProjectEntity | null,
  homeHostId: string | null,
): { body: CreateSessionDto; hostId: string } | { refusal: string } {
  if (!input.folder && !project) {
    return {
      refusal: 'Give a project_id (to work in one of its repositories) or a folder on the host.',
    };
  }
  const hostId = sessionHostId(input, project, homeHostId);
  if (!hostId) {
    return {
      refusal:
        'No host given, and neither the project nor you have a default one. Ask which host to use (list_hosts).',
    };
  }
  const checkout = input.folder ? null : pickRepository(project as ProjectEntity, input.repository);
  if (checkout && 'reason' in checkout) return { refusal: checkout.reason };
  const parsed = createSessionSchema.safeParse({
    hostId,
    agent: input.agent ?? project?.defaultAgent ?? 'claude-code',
    projectId: project?.id,
    name: input.name,
    prompt: input.task,
    launch: { permission: BOT_SESSION_PERMISSION },
    ...(input.folder
      ? { folder: input.folder }
      : { checkouts: [checkout], cwdGithubRepoId: checkout?.githubRepoId }),
  });
  return parsedPlan(parsed, hostId, 'Check the task, folder and name.');
}

/** What `start_cloud_session` takes: `start_session`'s input with no folder or watch, and the cloud's own fields. */
export interface StartCloudSessionInput {
  task: string;
  project_id: string;
  repository?: string;
  host_id?: string;
  name?: string;
  /** Which cloud: one a host starts with its own CLI, or a vendor launched on the owner's key. */
  agent?: CloudSessionAgent;
  /** A Codex cloud task's environment, by id or label. */
  codex_environment?: string;
  /** A vendor's model (Cursor's); the vendor's own pick when omitted. */
  model?: string;
}

/**
 * The clouds `start_cloud_session` starts: Claude Code's and Codex's, which a
 * host starts with its signed-in CLI (`HOST_CLOUD_AGENT_IDS`), and each vendor
 * the control plane launches on the owner's own key with no host
 * (`CLOUD_AGENT_PROVIDERS`, Cursor's). The same three places New session, a
 * task and an automation offer (`product/next-steps/cloud-agents.md`).
 */
export const CLOUD_SESSION_AGENTS = [...HOST_CLOUD_AGENT_IDS, ...CLOUD_AGENT_PROVIDERS] as const;
export type CloudSessionAgent = (typeof CLOUD_SESSION_AGENTS)[number];

/** The cloud a call names: Claude Code's when it names none. */
export function cloudAgentOf(input: Pick<StartCloudSessionInput, 'agent'>): CloudSessionAgent {
  return input.agent ?? 'claude-code';
}

/** Whether the cloud is a vendor the control plane launches, with no host. */
export function isLaunchedCloud(agent: CloudSessionAgent): agent is CloudAgentProviderId {
  return CLOUD_AGENT_PROVIDERS.some((provider) => provider === agent);
}

/**
 * How `start_cloud_session`'s input becomes a session a host starts in its
 * agent's cloud: Claude Code's (`claude --cloud <task>`) or Codex's (`codex
 * cloud exec`), from a scratch checkout of one of the project's repositories
 * (`createSessionSchema`'s `cloud`), the same body the console's cloud place
 * and a `claude-cloud` automation send. The host is chosen as `start_session`
 * chooses it; it only starts the session, which then lives at the vendor. Pure.
 */
export function planCloudSession(
  input: StartCloudSessionInput,
  project: ProjectEntity,
  homeHostId: string | null,
): { body: CreateSessionDto; hostId: string } | { refusal: string } {
  const agent = cloudAgentOf(input);
  if (isLaunchedCloud(agent)) {
    return { refusal: `${CLOUD_AGENT_PROVIDER_LABELS[agent]} is launched with no host.` };
  }
  if (input.model !== undefined) {
    return {
      refusal: `model is only for a vendor's cloud (${CLOUD_AGENT_PROVIDERS.join(', ')}); leave it out for ${agent}.`,
    };
  }
  if (input.codex_environment !== undefined && agent !== 'codex') {
    return { refusal: 'codex_environment is only for the agent codex; leave it out.' };
  }
  const hostId = sessionHostId(input, project, homeHostId);
  if (!hostId) {
    return {
      refusal: `No host given, and neither the project nor you have a default one. A cloud session is started by a host whose ${CLOUD_CLI[agent]} is signed in: ask which one to use (list_hosts).`,
    };
  }
  const checkout = pickRepository(project, input.repository);
  if ('reason' in checkout) return { refusal: checkout.reason };
  const parsed = createSessionSchema.safeParse({
    hostId,
    agent,
    projectId: project.id,
    name: input.name,
    prompt: input.task,
    cloud: true,
    checkouts: [checkout],
    ...(input.codex_environment === undefined ? {} : { codexEnvironment: input.codex_environment }),
  });
  return parsedPlan(parsed, hostId, 'Check the task, name and codex_environment.');
}

/**
 * How `start_cloud_session`'s input becomes a session a vendor runs with no
 * host: its agent on one of the project's repositories, from its base branch,
 * on the owner's own key (`POST /sessions/cloud`'s body, what the console's
 * Cloud section and a `cursor` automation send). Pure.
 */
export function planLaunchedCloudSession(
  input: StartCloudSessionInput,
  provider: CloudAgentProviderId,
  project: ProjectEntity,
): { body: StartCloudSessionDto } | { refusal: string } {
  const label = CLOUD_AGENT_PROVIDER_LABELS[provider];
  if (input.host_id !== undefined) {
    return { refusal: `${label} runs in its own cloud with no host; leave host_id out.` };
  }
  if (input.codex_environment !== undefined) {
    return { refusal: 'codex_environment is only for the agent codex; leave it out.' };
  }
  const checkout = pickRepository(project, input.repository);
  if ('reason' in checkout) return { refusal: checkout.reason };
  const parsed = startCloudSessionSchema.safeParse({
    provider,
    projectId: project.id,
    name: input.name,
    checkout,
    prompt: input.task,
    ...(input.model === undefined ? {} : { model: input.model }),
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => toolField(issue.path.join('.')));
    return {
      refusal: `Not started: the session would be invalid (${[...new Set(fields)].join(', ')}). Check the task, name and model.`,
    };
  }
  return { body: parsed.data };
}

/** The CLI on the host that starts each host-started cloud, which must be signed in. */
const CLOUD_CLI: Readonly<Record<HostCloudAgentId, string>> = {
  'claude-code': 'claude',
  codex: 'codex',
};

/** Where each cloud's session lives, as the person opens it. */
export const CLOUD_SITE: Readonly<Record<CloudSessionAgent, string>> = {
  'claude-code': 'claude.ai',
  codex: 'chatgpt.com/codex',
  cursor: 'cursor.com',
};

/** What a host-started cloud's failure most often means, for the model to pass on. */
export function cloudStartHint(agent: HostCloudAgentId): string {
  return `most often the host's ${CLOUD_CLI[agent]} is not installed or not signed in`;
}

/**
 * A cloud session's page at its vendor, by the id its host reported:
 * claude.ai/code for Claude Code's (what `claude --cloud` printed),
 * chatgpt.com/codex for a Codex task. The console's `cloudUrl`, server side.
 */
export function cloudSessionUrl(agent: string, cloudSessionId: string): string {
  const id = encodeURIComponent(cloudSessionId);
  return agent === 'codex'
    ? `https://chatgpt.com/codex/tasks/${id}`
    : `https://claude.ai/code/${id}`;
}

function parsedPlan(
  parsed: ReturnType<typeof createSessionSchema.safeParse>,
  hostId: string,
  check: string,
): { body: CreateSessionDto; hostId: string } | { refusal: string } {
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => toolField(issue.path.join('.')));
    return {
      refusal: `Not started: the session would be invalid (${[...new Set(fields)].join(', ')}). ${check}`,
    };
  }
  return { body: parsed.data, hostId };
}

/**
 * The session body's fields that `start_session`'s input names otherwise, so
 * a refusal names the field the model wrote: it never sees `prompt`.
 */
const TOOL_FIELD_OF: Readonly<Record<string, keyof StartSessionInput>> = {
  prompt: 'task',
  hostId: 'host_id',
  projectId: 'project_id',
};

/** A rejected field of the session's body, as the tool's input names it. */
function toolField(path: string): string {
  return TOOL_FIELD_OF[path] ?? (path || 'input');
}

/** How much of the task a Needs input card shows. */
const TASK_IN_SUMMARY_MAX = 200;

/** The host a `start_session` call runs on: the one named, the project's default, the home host. */
export function sessionHostId(
  input: Pick<StartSessionInput, 'host_id'>,
  project: ProjectEntity | null,
  homeHostId: string | null,
): string | null {
  return input.host_id ?? project?.defaultHostId ?? homeHostId;
}

/**
 * The Needs input card's line for a `start_session` call: "Start Claude Code
 * on build-02 in acme/xrp-mobile, and hear back when it ends: Fix the
 * failing test", the task cut to fit. `hostName` is the host as the owner sees it, or null when none is set.
 */
export function sessionSummary(
  input: StartSessionInput,
  project: ProjectEntity | null,
  hostName: string | null,
): string {
  const id = input.agent ?? project?.defaultAgent;
  const agent: CodingAgentId = CODING_AGENT_IDS.find((known) => known === id) ?? 'claude-code';
  const repository = project && !input.folder ? repositoryOf(project, input.repository) : null;
  const where = input.folder
    ? ` in ${input.folder}`
    : repository
      ? ` in ${repository}`
      : input.project_id
        ? ` in project ${input.project_id}`
        : '';
  const hearBack = input.watch === false ? '' : ', and hear back when it ends';
  return `Start ${CODING_AGENTS[agent].label} on ${hostName ?? 'no host yet'}${where}${hearBack}: ${clippedTask(input.task)}`;
}

/**
 * The Needs input card's line for a `start_cloud_session` call: "Start a
 * Claude Code cloud session from build-02 in acme/xrp-mobile: Fix the failing
 * test", or for a vendor with no host "Start a Cursor cloud session in
 * acme/xrp-mobile, on your Cursor key: …", the task cut to fit.
 */
export function cloudSessionSummary(
  input: StartCloudSessionInput,
  project: ProjectEntity | null,
  hostName: string | null,
): string {
  const agent = cloudAgentOf(input);
  const repository = project ? repositoryOf(project, input.repository) : null;
  const where = repository ? ` in ${repository}` : ` in project ${input.project_id}`;
  if (isLaunchedCloud(agent)) {
    const label = CLOUD_AGENT_PROVIDER_LABELS[agent];
    const model = input.model ? `, model ${input.model}` : '';
    return `Start a ${label} cloud session${where}, on your ${label} key${model}: ${clippedTask(input.task)}`;
  }
  return `Start a ${CODING_AGENTS[agent].label} cloud session from ${hostName ?? 'no host yet'}${where}: ${clippedTask(input.task)}`;
}

function clippedTask(text: string): string {
  const task = text.replace(/\s+/g, ' ').trim();
  return task.length > TASK_IN_SUMMARY_MAX ? `${task.slice(0, TASK_IN_SUMMARY_MAX - 1)}…` : task;
}

function repositoryOf(project: ProjectEntity, name: string | undefined): string | null {
  const repositories = project.repositories;
  const chosen = name
    ? repositories.find((repo) => repo.repositoryFullName.toLowerCase() === name.toLowerCase())
    : (repositories.find((repo) => repo.isDefault) ?? repositories[0]);
  return chosen?.repositoryFullName ?? null;
}

/** The project's repository to check out: the one named, or its default. */
function pickRepository(
  project: ProjectEntity,
  name: string | undefined,
): { installationId: string; githubRepoId: number; baseBranch: string } | { reason: string } {
  const repositories = project.repositories;
  const chosen = name
    ? repositories.find((repo) => repo.repositoryFullName.toLowerCase() === name.toLowerCase())
    : (repositories.find((repo) => repo.isDefault) ?? repositories[0]);
  if (!chosen) {
    const names = repositories.map((repo) => repo.repositoryFullName).join(', ') || 'none';
    return {
      reason: name
        ? `The project has no repository ${name}. Its repositories: ${names}.`
        : 'The project has no repository. Use a folder, or ask the person to add one to the project.',
    };
  }
  return {
    installationId: chosen.installationId,
    githubRepoId: Number(chosen.githubRepoId),
    baseBranch: chosen.baseBranch,
  };
}

/**
 * What the console's dot says about a session (`SessionGroup`), in words a
 * model can act on: the same group the person sees beside it in the sidebar.
 */
export const SESSION_GROUP_PHRASES: Readonly<Record<SessionGroup, string>> = {
  working: 'the agent is at work',
  'waiting-on-you': 'needs a person: it failed, is blocked on a question, or is stuck starting',
  'ready-for-review': 'finished, with a report nobody has read yet',
  landing: 'its pull request is open and approved, not yet merged',
  idle: 'at its prompt, nothing new to read',
  resolved: 'closed',
};

/** The pending decision of a session, as lines a bot reads before answering it. */
export function describeDecision(decision: SessionDecision): string[] {
  if (decision.kind === 'permission') {
    return [
      `- waiting on a permission dialog (decision ${decision.id}): ${decision.title}`,
      ...(decision.detail ? [`  about: ${cut(decision.detail, 500)}`] : []),
      ...decision.options.map((option, index) => `  option ${index}: ${option.label}`),
    ];
  }
  return [
    `- waiting on ${decision.questions.length === 1 ? 'a question' : `${decision.questions.length} questions`} (decision ${decision.id}):`,
    ...decision.questions.flatMap((question, index) => [
      `  question ${index}${question.multiSelect ? ' (several may be picked)' : ''}: ${question.question}`,
      ...question.options.map(
        (option, pick) =>
          `    pick ${pick}: ${option.label}${option.description ? ` (${cut(option.description, 120)})` : ''}`,
      ),
    ]),
  ];
}

/** How much of a prompt or an answer a Needs input card shows. */
const WORDS_IN_SUMMARY_MAX = 200;

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > WORDS_IN_SUMMARY_MAX ? `${flat.slice(0, WORDS_IN_SUMMARY_MAX - 1)}…` : flat;
}

/** The session as a card names it. */
interface NamedSession {
  id: string;
  name: string;
  pendingDecision: SessionDecision | null;
}

/** The Needs input card's line for `send_to_session`: "Tell the session "Fix login": run the tests again". */
export function promptSummary(input: { text: string }, session: NamedSession): string {
  return `Tell the session "${session.name}": ${clip(input.text)}`;
}

/** An `answer_session` call, as its input names it. */
export interface DecisionAnswerInput {
  decision_id: string;
  answers?: { picks: number[]; other?: string }[];
  option?: number;
}

/**
 * The Needs input card's line for `answer_session`, read against what the
 * session waits on now, so the card names the options rather than their
 * indexes: "Answer "Fix login"'s permission dialog "Run pnpm test?": Yes".
 * A refusal when nothing it names is pending, or the answer does not fit.
 */
export function decisionAnswerSummary(
  input: DecisionAnswerInput,
  session: NamedSession,
): { line: string } | { refusal: string } {
  const decision = session.pendingDecision;
  if (!decision || decision.id !== input.decision_id) {
    return {
      refusal: decision
        ? `Session ${session.id} now waits on decision ${decision.id}, not ${input.decision_id}. Read it again with get_session.`
        : `Session ${session.id} waits on no decision now.`,
    };
  }
  if (decision.kind === 'permission') {
    const option = input.option === undefined ? undefined : decision.options[input.option];
    if (!option) {
      return {
        refusal: `A permission dialog takes option, one of 0 to ${decision.options.length - 1}.`,
      };
    }
    return { line: `Answer "${session.name}"'s dialog "${clip(decision.title)}": ${option.label}` };
  }
  const answers = input.answers;
  if (!answers || answers.length !== decision.questions.length) {
    return {
      refusal: `That decision has ${decision.questions.length} question(s): give one answer for each.`,
    };
  }
  const said = decision.questions.map((question, index) => {
    const answer = answers[index] ?? { picks: [] };
    const labels = answer.picks.map((pick) => question.options[pick]?.label ?? `option ${pick}`);
    if (answer.other?.trim()) labels.push(`"${answer.other.trim()}"`);
    return `${clip(question.question)} ${labels.join(', ') || '(nothing)'}`;
  });
  return { line: `Answer "${session.name}": ${clip(said.join('; '))}` };
}

/** An `answer_session` call as the sessions' answer: words of the bot's own trimmed, none as null. */
export function decisionAnswerOf(input: DecisionAnswerInput): AnswerSessionDecisionDto {
  return {
    id: input.decision_id,
    answers: input.answers?.map((answer) => ({
      picks: answer.picks,
      other: answer.other?.trim() || null,
    })),
    option: input.option,
  };
}

/**
 * The task a follow-up prompt lands in, from the latest as it stood before
 * the prompt: the next one, or the live one it joins (`foldTurnEvent`).
 */
export function sentTurnOf(latest: Pick<SessionTurnFold, 'seq' | 'state'> | null): number {
  if (latest && isLiveTurn(latest)) return latest.seq;
  return (latest?.seq ?? 0) + 1;
}

/**
 * How `list_sessions` reads a `group` filter. The group is derived on read
 * against the clock, so no index holds it: `resolved` is also a stored state
 * and pages like any filter; any other group is read off the `scan` newest
 * sessions and filtered here. Null when no group is asked for.
 */
export function groupScanOf(
  group: SessionGroup | undefined,
  scan: number,
): { state: 'resolved' } | { scan: number; group: SessionGroup } | null {
  if (group === undefined) return null;
  return group === 'resolved' ? { state: 'resolved' } : { scan, group };
}

/** A session as `wait_for_session` reads it: closed or not, and its latest task. */
export function waitViewOf(session: {
  isResolved: boolean;
  latestTurn: { seq: number; state: string } | null;
}): SessionWaitView {
  return { resolved: session.isResolved, latestTurn: session.latestTurn };
}

/**
 * The hint a tool that typed into a session ends with: the log entry its
 * input was recorded as, so `read_session` after it reads only the answer.
 * None when the command recorded none.
 */
export function readAfterHint(seq: number | undefined): string {
  return seq === undefined
    ? ''
    : ` Its log was at entry ${seq}: read_session with after_seq ${seq} reads only what followed.`;
}
