import type { CreateSessionDto, SessionPermissionDto } from '@oppenheimer/shared';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';

/** The agent a review session runs. */
const REVIEW_AGENT = 'claude-code' as const;

/**
 * The permission level a review session runs at. A review reads and runs
 * (`git diff`, tests) but must not edit, and the catalog's levels cannot say
 * that: `auto` is Claude Code's `acceptEdits`, which still prompts on every
 * command, so the review takes `full` and the prompt rules out edits, commits
 * and pushes. A level for Claude Code's own `auto` mode would replace this.
 */
const REVIEW_PERMISSION: SessionPermissionDto = 'full';

/** What a review session needs to know of the pull request it reviews. */
export interface ReviewedPullRequest {
  installationId: string;
  githubRepoId: number;
  repository: string;
  number: number;
  title: string;
  headRef: string;
  baseRef: string;
}

/**
 * The first task a review session starts on. It asks for a short opening (what
 * changes, the riskiest part, where to look first), then a wait, and it rules
 * out edits: the session is for reading the pull request, not for changing it.
 * It goes to the agent, so it is not translated.
 */
export function reviewPrompt(pull: ReviewedPullRequest): string {
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
 * The session a review asks for: Claude Code on its default model, in a
 * worktree cut from the head branch on the picked host, on the review prompt.
 * It runs without permission prompts (`REVIEW_PERMISSION`).
 */
export function reviewSessionInput(pull: ReviewedPullRequest, hostId: string): CreateSessionDto {
  const models = CODING_AGENTS[REVIEW_AGENT].models;
  const model = (models.find((row) => row.default) ?? models[0])?.id ?? null;
  return {
    hostId,
    agent: REVIEW_AGENT,
    name: `Review #${pull.number}`,
    checkouts: [
      {
        installationId: pull.installationId,
        githubRepoId: pull.githubRepoId,
        baseBranch: pull.headRef,
      },
    ],
    cwdGithubRepoId: pull.githubRepoId,
    launch: { model, permission: REVIEW_PERMISSION },
    prompt: reviewPrompt(pull),
  };
}
