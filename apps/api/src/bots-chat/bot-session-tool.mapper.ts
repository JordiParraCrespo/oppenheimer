import {
  type AnswerSessionDecisionDto,
  type CreateSessionDto,
  createSessionSchema,
  type SessionDecision,
  type SessionGroup,
} from '@oppenheimer/shared';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import type { ProjectEntity } from '../projects/domain/project.entity';
import { isLiveTurn, type SessionTurnFold } from '../sessions/domain/session-turn.policy';
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
