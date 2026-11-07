/**
 * The spend guard on a bot's routines (`26-bot-routines.md` §6): routines
 * that keep running while nobody reads what they say are money for nothing.
 * Like an agent watching a pull request for someone who stopped looking, a
 * bot stops on its own once its owner is away, says so once, and starts
 * again as soon as they are back in its chat (`ownerSeenAt`).
 *
 * Away is either of two things, whichever comes first:
 * - the bot's routines have said something the owner has not seen three
 *   times since they were last in its chat (a quiet turn,
 *   `nothing_to_report`, says nothing and does not count);
 * - the owner has not been in its chat for three days, whatever the
 *   routines said, so a heartbeat that only ever stays quiet still stops.
 */

/** Reports the owner has not seen before the routines stop. */
export const UNREAD_ROUTINE_REPORTS_LIMIT = 3;

/** How long the owner may be away from the chat before the routines stop. */
export const OWNER_AWAY_LIMIT_MS = 72 * 60 * 60 * 1000;

export interface RoutineSpendGuardInput {
  /** The bot's routine turns that wrote something, since `ownerSeenAt`. */
  unreadReports: number;
  /** When the owner was last in the bot's chat; null when it was never stored. */
  ownerSeenAt: Date | null;
  now: Date;
}

/** Whether a routine of the bot may run now, or its routines stop until the owner is back. */
export function routineSpendGuard(input: RoutineSpendGuardInput): 'allow' | 'pause' {
  if (input.unreadReports >= UNREAD_ROUTINE_REPORTS_LIMIT) return 'pause';
  if (!input.ownerSeenAt) return 'allow';
  const away = input.now.getTime() - input.ownerSeenAt.getTime();
  return away >= OWNER_AWAY_LIMIT_MS ? 'pause' : 'allow';
}

/** The one Inbox line that says the routines stopped, and what starts them again. */
export function unattendedNotice(): string {
  return 'I paused my routines while you were away. They start again when you open this chat.';
}
