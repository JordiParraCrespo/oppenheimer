import type { BotTurnFailure, BotTurnOrigin } from '@oppenheimer/shared';
import type { BotTurnEntity } from './bot-turn.entity';

/**
 * A turn nobody asked for does not run into a provider that just refused the
 * bot's account (2026-11-15). Web PM's chat filled with "The Anthropic
 * account is out of quota or credit", one card per routine run and wake,
 * each a second long: a goal pauses and a loop stops on that failure, but a
 * routine or a subscription's wake queued the next turn regardless. Once a
 * turn on the provider fails because the account is spent or its key or
 * sign-in was refused, the routines' runs that follow are skipped before
 * they queue a turn (`BotRoutineTarget`), and the wakes' turns end without
 * reaching it (silently, as a turn with nothing to say), until
 * `BOT_PROVIDER_HOLD_MS` has passed; the first after that tries again, and
 * one more failure holds them again. A person's message always runs, and
 * once one gets through the hold is gone.
 */

/** How long a refused account holds the turns nobody asked for. */
export const BOT_PROVIDER_HOLD_MS = 60 * 60 * 1000;

/** The failures of the account rather than of the turn: retrying does not help until it is fixed. */
const ACCOUNT_FAILURES: readonly BotTurnFailure[] = ['usage_limit', 'credential'];

/**
 * The turns that run with nobody waiting and nothing else to stop them: a
 * goal pauses and a loop stops on the failure on their own, and a bot's ask
 * is answered by its turn's end, so they keep their own rules.
 */
const HELD_ORIGINS: readonly BotTurnOrigin[] = ['routine', 'subscription'];

/** Whether a turn of this origin can be held at all: the read of the last turn is spent only then. */
export function holdableOrigin(origin: BotTurnOrigin): boolean {
  return HELD_ORIGINS.includes(origin);
}

/** The bot's last turn on the provider that reached it or failed, as the hold reads it. */
export type LastProviderTurn = Pick<BotTurnEntity, 'status' | 'failure' | 'endedAt'>;

/** Whether the turn ends without running, held by the provider's refusal of the account. */
export function heldByProvider(
  turn: Pick<BotTurnEntity, 'origin'>,
  last: LastProviderTurn | null,
  now: Date,
): boolean {
  if (!holdableOrigin(turn.origin)) return false;
  if (!last || last.status !== 'failed' || !last.endedAt) return false;
  if (!last.failure || !ACCOUNT_FAILURES.includes(last.failure)) return false;
  return now.getTime() - last.endedAt.getTime() < BOT_PROVIDER_HOLD_MS;
}
