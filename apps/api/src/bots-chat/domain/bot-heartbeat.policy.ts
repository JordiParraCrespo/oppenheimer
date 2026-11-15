import type { AutomationRunCause } from '@oppenheimer/shared/automations';

/**
 * A bot's heartbeat (`26-bot-routines.md` §6): a routine named Heartbeat that
 * wakes the bot on its own to check in on what it looks after. Since
 * 2026-11-15 no bot is given one by default; a bot that has one (an owner
 * resumed it, or asked the bot for one) beats only when a beat can be worth a
 * model turn: inside the owner's waking hours, and when something happened in
 * the bot's chat since its last beat. Event wakes (a pull request it watches,
 * new mail, a session it follows) still wake it at once, at any hour.
 */

/** The routine's name, which is how a bot's heartbeat is recognised. */
export const HEARTBEAT_NAME = 'Heartbeat';

/** The owner's waking hours, in their zone: a beat at or after `start` and before `end`. */
export const HEARTBEAT_ACTIVE_HOURS = { start: 8, end: 22 } as const;

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
  /** The zone the owner last wrote to the bot from; null when unknown. */
  ownerTimeZone: string | null;
}

export type HeartbeatSkip = 'outside_active_hours' | 'idle';

/**
 * Whether this beat is skipped without a model turn, and why. Only a
 * scheduled beat is: the owner's Run now always runs. Outside the owner's
 * waking hours it waits for morning; inside them it runs on its first beat
 * and whenever something happened since the last one, and otherwise has
 * nothing new to look at.
 */
export function heartbeatSkip(
  cause: AutomationRunCause,
  view: HeartbeatView,
  now: Date,
): HeartbeatSkip | null {
  if (cause === 'manual') return null;
  const hour = localHour(now, view.ownerTimeZone);
  if (hour < HEARTBEAT_ACTIVE_HOURS.start || hour >= HEARTBEAT_ACTIVE_HOURS.end) {
    return 'outside_active_hours';
  }
  if (view.lastBeatAt === null) return null;
  if (view.lastActivityAt !== null && view.lastActivityAt > view.lastBeatAt) return null;
  return 'idle';
}

/** The hour of `now` on the clock of `timeZone`, or UTC's when it is unknown or not a zone. */
function localHour(now: Date, timeZone: string | null): number {
  try {
    const hour = new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: timeZone ?? 'UTC',
    }).format(now);
    return Number(hour);
  } catch {
    return now.getUTCHours();
  }
}
