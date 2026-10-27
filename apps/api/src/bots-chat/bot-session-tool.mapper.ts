import {
  type CreateSessionDto,
  createSessionSchema,
  type SessionDecision,
  type SessionGroup,
} from '@oppenheimer/shared';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import type { ProjectEntity } from '../projects/domain/project.entity';
import { cut, formatToolTime } from './domain/bot-tool-text.policy';

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
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => toolField(issue.path.join('.')));
    return {
      refusal: `Not started: the session would be invalid (${[...new Set(fields)].join(', ')}). Check the task, folder and name.`,
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
  input: StartSessionInput,
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
  const task = input.task.replace(/\s+/g, ' ').trim();
  const clipped =
    task.length > TASK_IN_SUMMARY_MAX ? `${task.slice(0, TASK_IN_SUMMARY_MAX - 1)}…` : task;
  const hearBack = input.watch === false ? '' : ', and hear back when it ends';
  return `Start ${CODING_AGENTS[agent].label} on ${hostName ?? 'no host yet'}${where}${hearBack}: ${clipped}`;
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

/** One log entry as `read_session` shows it; what the log records, never more. */
export interface SessionActivityEntry {
  kind: string;
  source: string;
  payload: unknown;
  occurredAt: Date;
}

/** How much of a prompt, a result or a failure one activity line shows. */
const ACTIVITY_TEXT_MAX = 600;

/**
 * A session's recent log as lines, oldest first (`read_session`). Each entry
 * is said in words; repeated reports of the same agent state fold into one;
 * the sender of a follow-up is named only when the API wrote the entry, so a
 * host cannot put words in a bot's mouth. Kinds it does not know are named,
 * their payloads never shown.
 */
export function describeSessionActivity(
  entries: readonly SessionActivityEntry[],
  timeZone: string,
): string[] {
  const lines: string[] = [];
  let lastObserved: string | null = null;
  for (const entry of entries) {
    const said = describeEntry(entry, lastObserved);
    if (entry.kind === 'agent.observed') lastObserved = textField(entry.payload, 'state');
    if (said) lines.push(`${formatToolTime(entry.occurredAt, timeZone)}: ${said}`);
  }
  return lines;
}

function describeEntry(entry: SessionActivityEntry, lastObserved: string | null): string | null {
  const { payload } = entry;
  const words = (name: string) => cut(textField(payload, name) ?? '', ACTIVITY_TEXT_MAX);
  switch (entry.kind) {
    case 'session.requested':
      return 'session requested';
    case 'session.started':
      return 'started on its host';
    case 'session.failed':
      return `failed${textField(payload, 'detail') ? `: ${words('detail')}` : ''}`;
    case 'session.stopped':
      return 'stopped';
    case 'session.restart_requested':
      return 'restart requested';
    case 'session.restarted':
      return 'restarted';
    case 'session.close_requested':
      return 'close requested';
    case 'session.closed':
      return 'closed';
    case 'session.named':
      return `named "${words('name')}"`;
    case 'session.moved':
      return 'moved to another project';
    case 'prompt.first':
      return `first task: ${words('text')}`;
    case 'prompt.sent':
      return `follow-up prompt${senderOf(entry)}: ${words('text')}`;
    case 'prompt.undelivered':
      return 'that follow-up never reached the host, so the agent did not get it';
    case 'turn.requested':
      return `follow-up requested: ${words('prompt')}`;
    case 'turn.ended':
      return `task ended${textField(payload, 'result') ? `: ${words('result')}` : ''}`;
    case 'agent.observed': {
      const state = textField(payload, 'state');
      return state && state !== lastObserved ? `agent ${state}` : null;
    }
    case 'agent.decision':
      return decisionLine(payload);
    case 'decision.answered':
      return 'the pending decision was answered';
    case 'command.failed':
      return `the host refused ${textField(payload, 'command') ?? 'a command'} (${textField(payload, 'code') ?? 'no code'})`;
    case 'report.published':
      return 'the agent left a report';
    case 'report.acknowledged':
      return 'its report was read';
    default:
      return entry.kind;
  }
}

/** "from bot <id>" when the API recorded it; nothing when a host wrote the entry. */
function senderOf(entry: SessionActivityEntry): string {
  if (entry.source !== 'api') return '';
  const sender = asRecord(asRecord(entry.payload).sender);
  return sender.kind === 'bot' && typeof sender.botId === 'string'
    ? ` from bot ${sender.botId}`
    : '';
}

function decisionLine(payload: unknown): string {
  const decision = asRecord(asRecord(payload).decision);
  if (decision.kind === 'permission') {
    return `agent asks permission: ${cut(String(decision.title ?? ''), ACTIVITY_TEXT_MAX)}`;
  }
  if (decision.kind === 'question') {
    const first = asRecord(Array.isArray(decision.questions) ? decision.questions[0] : null);
    return `agent asks: ${cut(String(first.question ?? ''), ACTIVITY_TEXT_MAX)}`;
  }
  return 'the agent no longer waits on a decision';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function textField(payload: unknown, name: string): string | null {
  const value = asRecord(payload)[name];
  return typeof value === 'string' && value.trim() ? value : null;
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
