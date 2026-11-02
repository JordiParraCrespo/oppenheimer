/**
 * What a GitHub event on a pull request a session watches says to its agent
 * (`product/next-steps/agent-tools.md` §3): one line, made only of what the
 * event's metadata states — its kind, the pull request's number, a check's
 * conclusion, a review's state and who acted. Never a comment's or a
 * review's words: anyone who can comment on a public repository could write
 * them, and they would be typed into an agent on somebody's own machine. The
 * agent reads them itself, with `gh`, if it wants them.
 */

/** The events a watching session is woken by. */
export const WAKING_GITHUB_EVENTS = [
  'check_failed',
  'check_passed',
  'review',
  'comment',
  'pr_merged',
] as const;
export type WakingGithubEvent = (typeof WAKING_GITHUB_EVENTS)[number];

export function isWakingGithubEvent(type: string): type is WakingGithubEvent {
  return (WAKING_GITHUB_EVENTS as readonly string[]).includes(type);
}

/** A login as GitHub allows one, or nothing: no other character reaches the agent. */
function login(value: string | null): string | null {
  return value && /^[A-Za-z0-9-]{1,39}(\[bot\])?$/.test(value) ? value : null;
}

/** A word from GitHub's own vocabulary (a conclusion, a review state), or nothing. */
function word(value: unknown): string | null {
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

/**
 * The line for one event on pull request `number`, framed the way the runner
 * frames a child's report, so the agent reads it as the host's and not the
 * person's.
 */
export function githubWakeText(
  type: WakingGithubEvent,
  number: number,
  attributes: Record<string, unknown>,
  actorLogin: string | null,
): string {
  const by = login(actorLogin);
  const who = by ? ` by @${by}` : '';
  let what: string;
  switch (type) {
    case 'check_failed':
      what = `checks failed${checkName(attributes.check) ? ` (${checkName(attributes.check)})` : ''}: ${word(attributes.conclusion) ?? 'failure'}`;
      break;
    case 'check_passed':
      what = `checks passed${checkName(attributes.check) ? ` (${checkName(attributes.check)})` : ''}`;
      break;
    case 'review':
      what = `review submitted${who}: ${word(attributes.state) ?? 'commented'}`;
      break;
    case 'comment':
      what = `new comment${who}`;
      break;
    case 'pr_merged':
      what = `merged${who}`;
      break;
  }
  return `<oppenheimer from="github" event="${type}" pull="${number}">Pull request #${number}: ${what}. Read it with \`gh pr view ${number} --comments\` before you act on it.</oppenheimer>`;
}
