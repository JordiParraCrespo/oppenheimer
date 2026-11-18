import type { BotSessionWakeState } from '@oppenheimer/shared';
import { promptText } from './bot-prompt-text.policy';
import { wakeStateOf } from './bot-subscription.policy';

/**
 * A bot's bounded wait on a session inside its turn (from
 * Grok Bot's `Await`):
 * it waits until the session's current task stops for something a watch
 * would wake it for (input needed, finished, failed, stopped, expired), or
 * the session is resolved, or its deadline passes, whichever comes first.
 * It is bounded so a turn does not idle on one session: a longer wait is a
 * watch, which wakes the bot in a turn of its own.
 */

/** The longest one wait may take. */
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
    return promptText('tools/sessions.session-wait-answer-session-still-working', {
      sessionId,
      waitedSeconds: String(waitedSeconds),
    });
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
  return promptText('tools/sessions.session-wait-answer-session-after-s', {
    sessionId,
    what,
    waitedSeconds: String(waitedSeconds),
  });
}
