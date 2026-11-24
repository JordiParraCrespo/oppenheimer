import type { BotCheckBackEvent, BotMessageEvent } from '@oppenheimer/shared';
import { eventNote } from './bot-history.policy';
import { BotMessageEntity } from './bot-message.entity';
import { promptText } from './bot-prompt-text.policy';
import { formatToolTime } from './bot-tool-text.policy';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * A bot checking back on anything it delegated or waits on (`check_back`,
 * `27-bot-subscriptions.md` §7.3), as rules: when each look of a chain is
 * due, when a chain stops, which call continues a chain and which starts
 * one, what a look is keyed on and what its turn opens with. Pure.
 *
 * A chain is the looks at one thing. A `check_back` call in a look's own
 * turn continues that look's chain at the next step; a call in any other
 * turn starts a chain at step 0, named by that turn's id. Since a turn is
 * one look of at most one chain, and a turn sets at most one look, the key
 * `check_back:<chain>:<step>` is the same however often a turn is retried,
 * and the look queues one turn however often its job is delivered.
 *
 * There is no table and no cap on chains a bot has pending: a chain needs a
 * call in each look to go on, so it ends the first time the bot does not
 * call, and a chain never outlives `BOT_CHECK_BACK_HORIZON_MS`. One look a
 * turn, and the backoff, bound what one chain costs (about fifteen short
 * turns in its day); a cap would need a row per chain to count.
 */

/** The first look of a chain with no time given, in minutes. */
export const BOT_CHECK_BACK_FIRST_MINUTES = 5;
/** The longest wait between two looks of the standard backoff, in minutes. */
export const BOT_CHECK_BACK_MAX_GAP_MINUTES = 120;
/** How long a chain lasts, from its first look being set; no look is set past it. */
export const BOT_CHECK_BACK_HORIZON_MS = 24 * 60 * 60 * 1000;
/** The time a call may give, in minutes from now. */
export const BOT_CHECK_BACK_MINUTES = { min: 1, max: 240 } as const;

const MINUTE_MS = 60_000;

/** Where a look's turn's key begins: a look is `check_back:<chain>:<step>`. */
export const CHECK_BACK_KEY_PREFIX = 'check_back:';

/**
 * The standard wait before look `step` (from 0), in minutes: 5, 10, 20, 40,
 * 80, then every 120.
 */
export function checkBackDelayMinutes(step: number): number {
  return Math.min(BOT_CHECK_BACK_FIRST_MINUTES * 2 ** step, BOT_CHECK_BACK_MAX_GAP_MINUTES);
}

/** The steps of the backoff before it reaches its longest gap, as the tool's description says them. */
export function checkBackBackoffText(): string {
  const steps: number[] = [];
  for (let step = 0; checkBackDelayMinutes(step) < BOT_CHECK_BACK_MAX_GAP_MINUTES; step += 1) {
    steps.push(checkBackDelayMinutes(step));
  }
  return `${steps.join(', ')} minutes`;
}

/** The chain a look belongs to, as its turn's opening event carries it. */
export interface CheckBackChain {
  chainId: string;
  step: number;
  chainStartedAt: Date;
}

/** One look to set: which chain and step, what it is about, when the chain started and when it is due. */
export interface CheckBackLook extends CheckBackChain {
  about: string;
  at: Date;
}

/** What a `check_back` call comes to: the look it sets, or a chain past its day. */
export type CheckBackPlan =
  | { kind: 'set'; look: CheckBackLook }
  | { kind: 'past_horizon'; chainStartedAt: Date; at: Date };

/**
 * What a `check_back` call sets. `from` is the chain of the look whose turn
 * made the call (`checkBackChainOf`), null for any other turn, which starts a
 * chain of its own named by `turnId`. `minutes` given wins over the backoff;
 * the step goes on counting either way. A look due past the chain's day is
 * refused, so the bot tells the person it stopped.
 */
export function planCheckBack(
  call: { about: string; minutes?: number | null },
  from: CheckBackChain | null,
  turnId: string,
  now: Date,
): CheckBackPlan {
  const chainId = from?.chainId ?? turnId;
  const step = from ? from.step + 1 : 0;
  const chainStartedAt = from?.chainStartedAt ?? now;
  const minutes = call.minutes ?? checkBackDelayMinutes(step);
  const at = new Date(now.getTime() + minutes * MINUTE_MS);
  if (at.getTime() - chainStartedAt.getTime() > BOT_CHECK_BACK_HORIZON_MS) {
    return { kind: 'past_horizon', chainStartedAt, at };
  }
  return { kind: 'set', look: { chainId, step, chainStartedAt, about: call.about, at } };
}

/** The chain a turn's opening event says it is a look of; null for a turn that is no look. */
export function checkBackChainOf(event: BotMessageEvent | null | undefined): CheckBackChain | null {
  if (event?.kind !== 'check_back') return null;
  const chainStartedAt = new Date(event.chainStartedAt);
  if (Number.isNaN(chainStartedAt.getTime())) return null;
  return { chainId: event.chainId, step: event.step, chainStartedAt };
}

/** The key a look's turn is queued under, so a job delivered twice queues one turn. */
export function checkBackSourceKey(chainId: string, step: number): string {
  return `${CHECK_BACK_KEY_PREFIX}${chainId}:${step}`;
}

/**
 * The turn a look queues and the event line that opens it: in the
 * background lane, as a subscription's wake is, with the scopes and zone of
 * the turn that set it, keyed by its chain and step.
 */
export function checkBackTurn(
  props: Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin' | 'sourceKey' | 'lane'>,
  look: Omit<CheckBackLook, 'at'>,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    origin: 'check_back',
    lane: 'background',
    sourceKey: checkBackSourceKey(look.chainId, look.step),
  });
  const event: BotCheckBackEvent = {
    kind: 'check_back',
    chainId: look.chainId,
    step: look.step,
    chainStartedAt: look.chainStartedAt.toISOString(),
    about: look.about,
  };
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: promptText('core/wake-check-back.opening', {
      look: String(look.step + 1),
      startedAt: formatToolTime(look.chainStartedAt, props.timeZone ?? 'UTC'),
      about: look.about,
    }),
    event,
    steps: [],
    position: 0,
  });
  return { turn, opening };
}

/** What a look's turn is asked: the look as Oppenheimer's note, then what to do about it. */
export function checkBackPrompt(content: string): string {
  return `${eventNote(content)}\n\n${promptText('core/wake-check-back.ask')}`;
}
