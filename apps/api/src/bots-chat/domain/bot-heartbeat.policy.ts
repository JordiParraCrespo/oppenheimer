import type { AutomationRunCause } from '@oppenheimer/shared/automations';

/**
 * A bot's heartbeat (`26-bot-routines.md` §6): a routine named Heartbeat that
 * wakes the bot on its own to check in on what it looks after. Since
 * 2026-11-15 no bot is given one by default, and the ones bots had were moved
 * to twice a day (09:00 and 18:00, migration `PauseDefaultBotHeartbeats`) and
 * paused; the owner turns one on, and
 * changes its times, from the Routines tab or in chat. A beat with nothing new
 * to look at is skipped before any model turn. Event wakes (a pull request it
 * watches, new mail, a session it follows) still wake the bot at once.
 */

/** The routine's name, which is how a bot's heartbeat is recognised. */
export const HEARTBEAT_NAME = 'Heartbeat';

/** What a scheduled beat is decided on, read once from the bot's turns. */
export interface HeartbeatView {
  /** When the heartbeat's own last turn was queued; null before its first beat. */
  lastBeatAt: Date | null;
  /**
   * When the bot's newest turn that the heartbeat could have something to
   * say about was queued: a message, an approval, an answer, a wake, a goal.
   * Another routine's or a loop's turn is not one: two schedules would keep
   * each other awake. Null when it has none.
   */
  lastActivityAt: Date | null;
}

/**
 * Whether this beat is skipped as `idle`, without a model turn: a scheduled
 * beat after an earlier one, with nothing in the bot's chat since. The
 * owner's Run now always runs, and so does a first beat.
 */
export function heartbeatIsIdle(cause: AutomationRunCause, view: HeartbeatView): boolean {
  if (cause === 'manual' || view.lastBeatAt === null) return false;
  return view.lastActivityAt === null || view.lastActivityAt <= view.lastBeatAt;
}
