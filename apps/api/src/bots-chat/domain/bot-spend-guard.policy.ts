/**
 * The spend guard on a bot's routines (`26-bot-routines.md` §6): routines
 * that keep running while nobody reads what they say are money for nothing.
 * Like an agent watching a pull request for someone who stopped looking, a
 * bot stops on its own once its owner is away, says so once, and starts
 * again as soon as they are back in its chat (`ownerSeenAt`).
 *
 * Away is either of two things, whichever comes first, at the workspace's
 * thresholds (3 reports and 72 h unless it set its own):
 * - the bot's routines have said something the owner has not seen that many
 *   times since they were last in its chat (a quiet turn,
 *   `nothing_to_report`, says nothing and does not count);
 * - the owner has not been in its chat for that long, whatever the routines
 *   said, so a heartbeat that only ever stays quiet still stops.
 *
 * The owner can turn it off for one bot (`bot."routineSpendGuard"`); the
 * caller asks only for a bot that has it on.
 */

export interface RoutineSpendGuardInput {
  /** The bot's routine turns that wrote something, since `ownerSeenAt`. */
  unreadReports: number;
  /** When the owner was last in the bot's chat; null when it was never stored. */
  ownerSeenAt: Date | null;
  /** The workspace's thresholds, from its automation limits. */
  limits: { unattendedReports: number; unattendedAwaySeconds: number };
  now: Date;
}

/** Whether a routine of the bot may run now, or its routines stop until the owner is back. */
export function routineSpendGuard(input: RoutineSpendGuardInput): 'allow' | 'pause' {
  if (input.unreadReports >= input.limits.unattendedReports) return 'pause';
  if (!input.ownerSeenAt) return 'allow';
  const away = input.now.getTime() - input.ownerSeenAt.getTime();
  return away >= input.limits.unattendedAwaySeconds * 1000 ? 'pause' : 'allow';
}

/**
 * Whether the owner was back in the chat at or after `pausedAt`: a pause
 * delivered late finds them already back, and stops nothing more.
 */
export function ownerBackSince(ownerSeenAt: Date | null, pausedAt: Date): boolean {
  return ownerSeenAt !== null && ownerSeenAt.getTime() >= pausedAt.getTime();
}
