import type { WorkSessionEntity } from '../sessions/domain/work-session.entity';
import { describePlanWatch } from './bot-plan-tool.mapper';
import { promptText } from './domain/bot-prompt-text.policy';
import type { BotSubscriptionEntity } from './domain/bot-subscription.entity';
import { BOT_SUBSCRIPTION_WAKE_LIMIT } from './domain/bot-subscription.policy';
import { formatToolTime, RUNNER_TOO_OLD_ADVICE } from './domain/bot-tool-text.policy';

/**
 * How the watch tools word a subscription: what `watch_session` answers and
 * one line of `list_watches`. Pure.
 */

/** What `watch_session` answers: what is followed now, and what the session is doing. */
export function describeWatchStarted(
  subscription: BotSubscriptionEntity,
  session: WorkSessionEntity,
): string {
  const latest = session.latestTurn;
  const now = latest
    ? `Its latest task (#${latest.seq}) is ${latest.state}.`
    : 'It has no task yet.';
  const follows =
    subscription.until === 'task'
      ? `task #${subscription.watchedTurn}${latest && subscription.watchedTurn !== latest.seq ? ' (its next one)' : ''}, until it ends`
      : promptText('sessions/tools-watch.watch-session-answer-every-task');
  return promptText('sessions/tools-watch.watch-session-answer', {
    sessionId: session.id,
    sessionName: session.name,
    follows,
    now,
  });
}

/** What `watch_session` adds when it also watches the terminal, and what the host could not take. */
export function describePatternWatch(pattern: string, hints: readonly string[]): string {
  const watching = promptText('sessions/tools-watch.watch-session-pattern-answer', { pattern });
  if (hints.includes('not_supported')) {
    return promptText('sessions/tools-watch.watch-session-pattern-runner-too-old', {
      watching,
      advice: RUNNER_TOO_OLD_ADVICE,
    });
  }
  if (hints.includes('host_offline')) {
    return promptText('sessions/tools-watch.watch-session-pattern-host-offline', { watching });
  }
  return watching;
}

/** One line of `list_watches`: a session's, a pull request's, a project's or a milestone's. */
export function describeWatch(subscription: BotSubscriptionEntity, timeZone: string): string {
  const plan = subscription.plan;
  if (plan) return describePlanWatch(subscription, plan, timeZone);
  const woke = `woke you ${subscription.wakes} of ${BOT_SUBSCRIPTION_WAKE_LIMIT} times`;
  const since = `since ${formatToolTime(subscription.createdAt, timeZone)}`;
  const purpose = subscription.purpose ? ` — ${subscription.purpose}` : '';
  const pull = subscription.pullRequest;
  if (pull) {
    return promptText('sessions/tools-watch.list-watches-pull-request-line', {
      number: String(pull.number),
      repository: pull.repository,
      githubRepoId: pull.githubRepoId,
      parts: ['until merged', woke, since].join('; '),
      purpose,
    });
  }
  // What the line says of a session, in order; a part with nothing to say is left out.
  const parts = [
    subscription.until === 'task' ? `task #${subscription.watchedTurn}` : 'until closed',
    woke,
    subscription.lastState
      ? `last: task #${subscription.lastTurn} ${subscription.lastState}`
      : null,
    subscription.terminalWatch
      ? `pattern “${subscription.terminalWatch.pattern}”, ${subscription.matches} matching line${subscription.matches === 1 ? '' : 's'}`
      : null,
    since,
  ].filter(Boolean);
  return promptText('sessions/tools-watch.list-watches-session-line', {
    sessionId: String(subscription.resourceId),
    parts: parts.join('; '),
    purpose,
  });
}
