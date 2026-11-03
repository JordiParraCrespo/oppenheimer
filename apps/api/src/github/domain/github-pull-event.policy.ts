import { PULL_REQUEST_WAKE_EVENTS, type PullRequestWakeEvent } from '@oppenheimer/shared';

/**
 * What a GitHub event on a pull request says to whoever it wakes, a session's
 * agent (`product/next-steps/agent-tools.md` §3) or a bot
 * (`27-bot-subscriptions.md` §7): made only of what the event's metadata
 * states, its kind, a check's conclusion and name, a review's state and who
 * acted, each held to the characters GitHub allows. Never a comment's or a
 * review's words: anyone who can comment on a public repository could write
 * them. Whoever is woken reads them itself, with its own tools. Pure.
 */

export function isPullRequestWakeEvent(type: string): type is PullRequestWakeEvent {
  return (PULL_REQUEST_WAKE_EVENTS as readonly string[]).includes(type);
}

/** The event that ends a pull request's life, and with it whatever follows it. */
export function endsPullRequest(type: PullRequestWakeEvent): boolean {
  return type === 'pr_merged';
}

/**
 * The pull request's number from the event's attributes, or null when it has
 * none (a status on a commit) or names an issue rather than a pull request.
 */
export function pullNumberOf(attributes: Record<string, unknown> | undefined): number | null {
  const number = attributes?.number;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return null;
  if (attributes?.isPullRequest === false) return null;
  return number;
}

/** A login as GitHub allows one, or nothing: no other character reaches the reader. */
export function githubLogin(value: string | null): string | null {
  return value && /^[A-Za-z0-9-]{1,39}(\[bot\])?$/.test(value) ? value : null;
}

/** A word from GitHub's own vocabulary (a conclusion, a review state), or nothing. */
function githubWord(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z_]{1,32}$/.test(value)
    ? value.replace(/_/g, ' ')
    : null;
}

/** A check's name, kept to plain characters and cut short. */
function checkName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const plain = value.replace(/[^A-Za-z0-9 ._()-]/g, '').trim();
  return plain ? plain.slice(0, 60) : null;
}

/** `owner/name` as GitHub allows one, or nothing. */
export function githubRepositoryName(value: string | null): string | null {
  return value && /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(value) ? value : null;
}

/**
 * What happened, in a few words: "checks failed (CI): failure", "review
 * submitted by @octocat: changes requested", "merged by @octocat".
 */
export function pullEventPhrase(
  type: PullRequestWakeEvent,
  attributes: Record<string, unknown>,
  actorLogin: string | null,
): string {
  const by = githubLogin(actorLogin);
  const who = by ? ` by @${by}` : '';
  const check = checkName(attributes.check);
  switch (type) {
    case 'check_failed':
      return `checks failed${check ? ` (${check})` : ''}: ${githubWord(attributes.conclusion) ?? 'failure'}`;
    case 'check_passed':
      return `checks passed${check ? ` (${check})` : ''}`;
    case 'review':
      return `review submitted${who}: ${githubWord(attributes.state) ?? 'commented'}`;
    case 'comment':
      return `new comment${who}`;
    case 'pr_merged':
      return `merged${who}`;
  }
}
