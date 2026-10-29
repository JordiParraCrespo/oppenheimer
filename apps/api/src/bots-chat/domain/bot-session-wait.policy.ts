import type { BotSessionWakeState } from '@oppenheimer/shared';
import { wakeStateOf } from './bot-subscription.policy';

/**
 * A bot's bounded wait on a session inside its turn (`25-bots.md` §4.2;
 * from Grok Bot's `Await`, `research/lessons-from-grok-bot.md` §9 row 8):
 * it waits until the session's current task stops for something a watch
 * would wake it for (input needed, finished, failed, stopped, expired), or
 * the session is resolved, or its deadline passes, whichever comes first.
 * It never outlives the turn: the deadline is capped well inside it.
 */

/** The longest one wait may take. A turn stops after 4 minutes. */
export const BOT_SESSION_WAIT_MAX_SECONDS = 120;

/** How often a waiting call reads the session again. */
export const BOT_SESSION_WAIT_POLL_MS = 3_000;

/** The waits one turn may make: a wait is cheap, but a turn of waits does nothing. */
export const BOT_SESSION_WAITS_PER_TURN = 3;

/** What a wait found: settled, and how; or still running when its time ran out. */
export type SessionWaitOutcome =
  | { settled: true; state: BotSessionWakeState | 'resolved'; turnSeq: number | null }
  | { settled: false };

/** Where a session stands, as a wait reads it. */
export interface SessionWaitView {
  resolved: boolean;
  latestTurn: { seq: number; state: string } | null;
}

/** Whether the session has settled: resolved, or its current task in a state a watch wakes for. */
export function sessionWaitOutcome(session: SessionWaitView): SessionWaitOutcome {
  if (session.resolved) {
    return { settled: true, state: 'resolved', turnSeq: session.latestTurn?.seq ?? null };
  }
  const turn = session.latestTurn;
  const state = turn ? wakeStateOf(turn.state) : null;
  return turn && state ? { settled: true, state, turnSeq: turn.seq } : { settled: false };
}

/** The words a wait answers with: what happened, and where to read on. */
export function sessionWaitAnswer(
  sessionId: string,
  outcome: SessionWaitOutcome,
  waitedSeconds: number,
): string {
  if (!outcome.settled) {
    return `Session ${sessionId} is still working after ${waitedSeconds}s. Wait again, watch it with watch_session to be woken when it ends, or tell the person it is under way.`;
  }
  const what =
    outcome.state === 'resolved'
      ? 'was closed'
      : outcome.state === 'requires_action'
        ? 'needs input'
        : outcome.state === 'completed'
          ? 'finished its task'
          : outcome.state === 'failed'
            ? 'failed its task'
            : outcome.state === 'cancelled'
              ? 'had its task stopped'
              : 'had its task expire before it ran';
  return `Session ${sessionId} ${what} (after ${waitedSeconds}s). get_session shows its result or what it waits on; read_session what it did.`;
}
