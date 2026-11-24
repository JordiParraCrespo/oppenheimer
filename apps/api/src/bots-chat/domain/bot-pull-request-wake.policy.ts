import type { BotPullRequestEvent, PullRequestWakeEvent } from '@oppenheimer/shared';
import {
  endsPullRequest,
  githubRepositoryName,
  pullEventPhrase,
} from '../../github/domain/github-pull-event.policy';
import { eventNote } from './bot-history.policy';
import { BotMessageEntity } from './bot-message.entity';
import { promptText } from './bot-prompt-text.policy';
import type { PullRequestRef } from './bot-subscription.entity';
import { BOT_SUBSCRIPTION_WAKE_LIMIT } from './bot-subscription.policy';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * A bot following a pull request,
 * as rules: whether a GitHub event wakes it, what the wake is keyed on, and
 * what the bot reads. Unlike a session's, a pull request's wake is not a
 * fresh read: GitHub is not ours to re-read as the owner on every event, so
 * the wake is the event's metadata alone, held to the characters GitHub
 * allows (`pullEventPhrase`), and the bot reads the rest with its own GitHub
 * tools. A comment's or a review's words never reach it here. Pure.
 */

export type PullRequestWakeDecision =
  /** The wake limit is reached: the subscription ends without waking the bot. */
  | { kind: 'end'; reason: 'wake_limit' }
  /** Queue a turn; `ends` when it is the subscription's last (a merge, or the limit). */
  | { kind: 'wake'; ends: boolean };

/**
 * Whether an event on a followed pull request wakes the bot, from the wake
 * it claimed: the subscription's count with this wake in it, or null when
 * the limit left none. Every event that reaches here wakes it once (its key
 * is the stored event's id) until the limit; the wake that reaches the limit
 * is the last, and so is a merge, since nothing happens to a merged pull
 * request that the bot followed it for.
 */
export function pullRequestWakeFor(
  claimed: number | null,
  type: PullRequestWakeEvent,
): PullRequestWakeDecision {
  if (claimed === null) return { kind: 'end', reason: 'wake_limit' };
  return { kind: 'wake', ends: endsPullRequest(type) || claimed >= BOT_SUBSCRIPTION_WAKE_LIMIT };
}

/** What a pull request's wake tells the bot; `inboundEventId` makes one event one turn, however often delivered. */
export interface PullRequestWake extends PullRequestWakeEventFields {
  subscriptionId: string;
  pull: PullRequestRef;
  purpose: string | null;
  /** Whether this is the subscription's last wake. */
  ends: boolean;
}

/** The event as a wake reads it: the stored event's id and its metadata, never its context. */
export interface PullRequestWakeEventFields {
  inboundEventId: string;
  type: PullRequestWakeEvent;
  attributes: Record<string, unknown>;
  actorLogin: string | null;
}

/** The wake for one event on the pull request a subscription follows. */
export function pullRequestWakeOf(
  subscription: { id: string; purpose: string | null; pullRequest: PullRequestRef },
  ends: boolean,
  event: PullRequestWakeEventFields,
): PullRequestWake {
  return {
    subscriptionId: subscription.id,
    pull: subscription.pullRequest,
    purpose: subscription.purpose,
    ends,
    ...event,
  };
}

/** The key that makes one event one turn of the bot (`UQ_bot_turn_source`). */
export function pullRequestWakeSourceKey(
  wake: Pick<PullRequestWake, 'subscriptionId' | 'inboundEventId'>,
): string {
  return `subscription:${wake.subscriptionId}:github:${wake.inboundEventId}`;
}

/**
 * The wake's words for the bot, as it reads them now and in its history:
 * only what the event's metadata states, and how to read the rest. The
 * purpose is the bot's own words from when it watched.
 */
export function pullRequestWakeText(wake: PullRequestWake): string {
  const { pull } = wake;
  const repository = githubRepositoryName(pull.repository);
  const number = String(pull.number);
  const repoId = String(pull.githubRepoId);
  const happened = pullEventPhrase(wake.type, wake.attributes, wake.actorLogin);
  const lines = [
    repository
      ? promptText('github/wake-pull-request.headline-in-repository', {
          number,
          repository,
          repoId,
          happened,
        })
      : promptText('github/wake-pull-request.headline', { number, repoId, happened }),
  ];
  if (wake.purpose) {
    lines.push(promptText('github/wake-pull-request.followed-to', { purpose: wake.purpose }));
  }
  lines.push(
    promptText(
      wake.ends
        ? 'github/wake-pull-request.unsubscribed'
        : 'github/wake-pull-request.still-subscribed',
    ),
  );
  lines.push(promptText('github/wake-pull-request.read-it', { repoId, number }));
  return lines.join('\n');
}

/** What the turn a pull request's wake opens is asked, by what happened. */
const PULL_REQUEST_ASKS: Readonly<Record<PullRequestWakeEvent, string>> = {
  check_failed: promptText('github/wake-pull-request.ask-check-failed'),
  check_passed: promptText('github/wake-pull-request.ask-check-passed'),
  review: promptText('github/wake-pull-request.ask-review'),
  comment: promptText('github/wake-pull-request.ask-comment'),
  pr_merged: promptText('github/wake-pull-request.ask-merged'),
};

/**
 * What a turn opened by a pull request's wake is asked: the wake as
 * Oppenheimer's note, then what to do about it.
 */
export function pullRequestWakePrompt(event: BotPullRequestEvent, content: string): string {
  return `${eventNote(content)}

${PULL_REQUEST_ASKS[event.event]}

${promptText('github/wake-pull-request.closing')}`;
}

/**
 * The turn a pull request's wake queues and the event line that opens it:
 * in the background lane, as the bot's owner, with the scopes and zone of
 * the turn that subscribed, keyed so an event delivered twice is one turn.
 */
export function pullRequestWakeTurn(
  props: Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin' | 'sourceKey' | 'lane'>,
  wake: PullRequestWake,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    origin: 'subscription',
    lane: 'background',
    sourceKey: pullRequestWakeSourceKey(wake),
  });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: pullRequestWakeText(wake),
    event: {
      kind: 'pull_request',
      subscriptionId: wake.subscriptionId,
      githubRepoId: wake.pull.githubRepoId,
      repository: githubRepositoryName(wake.pull.repository) ?? '',
      number: wake.pull.number,
      event: wake.type,
    },
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
