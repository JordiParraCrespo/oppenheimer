import type { BotTurnOrigin } from '@oppenheimer/shared';
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
const HEARTBEAT_NAME = 'Heartbeat';

/**
 * The turns that are not news to a heartbeat: another schedule's (a
 * routine's, a loop's), its own included. Every other origin (a message, an
 * approval, an answer, another bot's ask, a wake, a goal) is activity. One
 * list, read by the repository's query and by nothing else.
 */
export const HEARTBEAT_QUIET_ORIGINS = [
  'routine',
  'loop',
] as const satisfies readonly BotTurnOrigin[];

/** What a scheduled beat is decided on, read once from the bot's turns. */
export interface HeartbeatView {
  /** When the heartbeat's own last turn was queued; null before its first beat. */
  lastBeatAt: Date | null;
  /**
   * When the bot's newest turn whose origin is not in
   * `HEARTBEAT_QUIET_ORIGINS` was queued; null when it has none. Another
   * schedule's turn does not count, or two schedules would keep each other
   * awake.
   */
  lastActivityAt: Date | null;
}

/**
 * Whether this run of a bot's routine is skipped as `idle`, before any
 * model turn: a scheduled beat of its heartbeat, after an earlier one, with
 * nothing in the bot's chat since. Any other routine, the owner's Run now, a
 * run an event trigger the owner added fired (the event is the news) and a
 * first beat all run. `readView` is asked only for a scheduled heartbeat
 * beat, so no other run pays for the read.
 */
export async function routineIsIdle(
  routine: { name: string; cause: AutomationRunCause },
  readView: () => Promise<HeartbeatView>,
): Promise<boolean> {
  if (routine.name !== HEARTBEAT_NAME || routine.cause !== 'schedule') return false;
  const { lastBeatAt, lastActivityAt } = await readView();
  if (lastBeatAt === null) return false;
  return lastActivityAt === null || lastActivityAt <= lastBeatAt;
}
