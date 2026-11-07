import { type PullRequestWakeEvent, SESSION_WAKE_MAX_DELAY_MS } from '@oppenheimer/shared';
import {
  githubRepositoryName,
  pullEventPhrase,
} from '../../github/domain/github-pull-event.policy';

/**
 * What a GitHub event on a pull request a session watches says to its agent
 * (`product/next-steps/agent-tools.md` §3): one line, made only of what the
 * event's metadata states — its kind, the pull request's number, a check's
 * conclusion, a review's state and who acted. Never a comment's or a
 * review's words: anyone who can comment on a public repository could write
 * them, and they would be typed into an agent on somebody's own machine. The
 * agent reads them itself, with `gh`, if it wants them.
 */

/**
 * The frame every wake's line is in, the way the runner frames a child's
 * report, so the agent reads it as the host's and not the person's. The
 * attributes are the caller's, already held to safe characters; a frame's
 * end inside the body is taken out, so the body cannot close it early.
 */
function hostFrame(attributes: Record<string, string>, body: string): string {
  const attrs = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
  return `<oppenheimer${attrs}>${body.replaceAll('</oppenheimer>', '').trim()}</oppenheimer>`;
}

/**
 * A wake's id on the `session-wakes` queue, by where it comes from: a stored
 * GitHub event's id and a runner's wake id are minted apart, so each gets a
 * prefix of its own and the two can never name one wake.
 */
export const wakeIds = {
  github: (inboundEventId: string) => `gh-${inboundEventId}`,
  schedule: (runnerWakeId: string) => `at-${runnerWakeId}`,
} as const;

/**
 * When a wake set for `askedIso` is due, from `now`: a time already past is
 * now, one further than a week is a week away (the runner refuses both
 * before they get here). Null for a time that is not one.
 */
export function wakeAt(askedIso: string, now: number): Date | null {
  const asked = Date.parse(askedIso);
  if (Number.isNaN(asked)) return null;
  return new Date(Math.min(Math.max(asked, now), now + SESSION_WAKE_MAX_DELAY_MS));
}

/**
 * The line for one event on pull request `number` of `repo` (the watching
 * session's checkout of it, `owner/name`), framed the way the runner frames
 * a child's report, so the agent reads it as the host's and not the
 * person's. The words of what happened are `pullEventPhrase`, which a bot
 * following the pull request is told too. The repository is named in the frame and in the command: a
 * session with several checkouts runs above all of them, where a bare
 * `gh pr view` would pick none, or the wrong one.
 */
export function githubWakeText(
  type: PullRequestWakeEvent,
  number: number,
  attributes: Record<string, unknown>,
  actorLogin: string | null,
  repo: string | null = null,
): string {
  const what = pullEventPhrase(type, attributes, actorLogin);
  const named = githubRepositoryName(repo);
  const view = named
    ? `gh pr view ${number} --repo ${named} --comments`
    : `gh pr view ${number} --comments`;
  return hostFrame(
    { from: 'github', event: type, ...(named ? { repo: named } : {}), pull: String(number) },
    `Pull request #${number}${named ? ` of ${named}` : ''}: ${what}. Read it with \`${view}\` before you act on it.`,
  );
}

/**
 * The line a wake the agent set for itself types back into its session
 * (`product/next-steps/agent-tools.md` §4): its own words, framed as the
 * host's so it reads them as a reminder and not as the person speaking. A
 * frame's end inside the words is taken out, so the words cannot close it.
 */
export function scheduledWakeText(wakeId: string, text: string): string {
  return hostFrame({ from: 'schedule', wake: wakeId }, text);
}
