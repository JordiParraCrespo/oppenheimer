/**
 * The spend guard's rule (`26-bot-routines.md` §6), as a table. What breaks
 * this: routines that run on for an owner who stopped reading, a quiet
 * heartbeat that never stops, or a guard that stops a bot whose owner is
 * there. Where it is read and what the pause does is
 * `bot-routine-target.adapter.spec.ts` and the pause and resume handlers'.
 */
import {
  OWNER_AWAY_LIMIT_MS,
  routineSpendGuard,
  UNREAD_ROUTINE_REPORTS_LIMIT,
  unattendedNotice,
} from '../domain/bot-spend-guard.policy';

const now = new Date('2026-11-07T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('routineSpendGuard', () => {
  it.each([
    ['nothing unseen, the owner here an hour ago', 0, ago(3_600_000), 'allow'],
    ['two reports unseen', UNREAD_ROUTINE_REPORTS_LIMIT - 1, ago(3_600_000), 'allow'],
    ['three reports unseen', UNREAD_ROUTINE_REPORTS_LIMIT, ago(3_600_000), 'pause'],
    ['quiet, away just under three days', 0, ago(OWNER_AWAY_LIMIT_MS - 1), 'allow'],
    ['quiet, away three days', 0, ago(OWNER_AWAY_LIMIT_MS), 'pause'],
    ['never stored as seen, nothing unseen', 0, null, 'allow'],
    ['never stored as seen, three unseen', UNREAD_ROUTINE_REPORTS_LIMIT, null, 'pause'],
  ] as const)('%s → %s', (_case, unreadReports, ownerSeenAt, expected) => {
    expect(routineSpendGuard({ unreadReports, ownerSeenAt, now })).toBe(expected);
  });

  it('tells the owner what starts the routines again', () => {
    expect(unattendedNotice()).toContain('open this chat');
  });
});
