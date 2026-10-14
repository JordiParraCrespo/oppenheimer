import type {
  CreateSessionCheckout,
  CreateSessionInput,
  HostEntity,
  PullRequestDetailEntity,
} from '@oppenheimer/frontend-consumer';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';

/** The agent a review session runs, and its model when nobody picks one. */
const REVIEW_AGENT = 'claude-code' as const;

/**
 * Where a review session runs: the online host the reader's latest session ran
 * on, else the first online host. `latestHostIds` is newest first. Undefined
 * when no host is online, since a session cut on an offline host would only
 * queue.
 */
export function reviewHost(
  hosts: readonly HostEntity[],
  latestHostIds: readonly string[],
): HostEntity | undefined {
  const online = hosts.filter((host) => host.online);
  const recent = latestHostIds.find((id) => online.some((host) => host.id === id));
  return online.find((host) => host.id === recent) ?? online[0];
}

/** The checkout a review session makes: the pull request's head branch, in its repository. */
export function reviewCheckout(pull: PullRequestDetailEntity): CreateSessionCheckout {
  return {
    installationId: pull.installationId,
    githubRepoId: pull.githubRepoId,
    baseBranch: pull.headRef,
  };
}

/**
 * The first task a review session starts on. It goes to the agent, not to the
 * reader, so it is not translated. It asks for a short opening (what changes,
 * the riskiest part, where to look first) and then a wait, and it rules out
 * edits: the session is for reading the pull request, not for changing it.
 */
export function reviewPrompt(pull: PullRequestDetailEntity): string {
  const base = `origin/${pull.baseRef}`;
  return [
    `Help me review pull request #${pull.number} in ${pull.repository}: "${pull.title}".`,
    `This worktree is its head branch (${pull.headRef}); it merges into ${pull.baseRef}.`,
    `Read the change with \`git diff ${base}...HEAD\` (run \`git fetch origin ${pull.baseRef}\` first only if ${base} is missing).`,
    'Answer first in 2 or 3 short lines: what it changes, the riskiest part, and where I should look first.',
    'Then wait for my questions. Do not edit files, commit or push.',
  ].join('\n');
}

/**
 * `POST /sessions` for a review: Claude Code on its default model, the head
 * branch checked out, the review prompt as its first task. Edits are approved
 * for it (`auto`) so reading the diff asks nothing; the prompt rules them out,
 * and anything else still asks.
 */
export function toReviewSession(pull: PullRequestDetailEntity, hostId: string): CreateSessionInput {
  const models = CODING_AGENTS[REVIEW_AGENT].models;
  const model = (models.find((row) => row.default) ?? models[0])?.id ?? null;
  return {
    hostId,
    agent: REVIEW_AGENT,
    name: `Review #${pull.number}`,
    checkouts: [reviewCheckout(pull)],
    cwdGithubRepoId: pull.githubRepoId,
    launch: { model, permission: 'auto' },
    prompt: reviewPrompt(pull),
  };
}
