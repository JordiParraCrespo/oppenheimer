/**
 * The spend guard's rule (`26-bot-routines.md` §6), as a table. What breaks
 * this: routines that run on for an owner who stopped reading, a quiet
 * heartbeat that never stops, a guard that stops a bot whose owner is there,
 * or a workspace's own thresholds ignored. The per-bot switch, and where it
 * is read and what the pause does, is
 * `bot-routine-target.adapter.spec.ts` and `automations/__tests__/unattended-routines.spec.ts`.
 */
import { DEFAULT_PLATFORM_LIMITS } from '../../automations/domain/automation-limits.policy';
import { ownerBackSince, routineSpendGuard } from '../domain/bot-spend-guard.policy';

const now = new Date('2026-11-07T12:00:00Z');
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(now.getTime() - ms);
const platform = {
  unattendedReports: DEFAULT_PLATFORM_LIMITS.defaults.unattendedReports,
  unattendedAwaySeconds: DEFAULT_PLATFORM_LIMITS.defaults.unattendedAwaySeconds,
};

describe('routineSpendGuard', () => {
  it('stops after 3 unseen reports or 72 h away, by default', () => {
    expect(platform).toEqual({ unattendedReports: 3, unattendedAwaySeconds: 72 * 3600 });
  });

  it.each<[string, number, Date | null, 'allow' | 'pause']>([
    ['nothing unseen, the owner here an hour ago', 0, ago(HOUR), 'allow'],
    ['two reports unseen', 2, ago(HOUR), 'allow'],
    ['three reports unseen', 3, ago(HOUR), 'pause'],
    ['quiet, away just under three days', 0, ago(72 * HOUR - 1), 'allow'],
    ['quiet, away three days', 0, ago(72 * HOUR), 'pause'],
    ['never stored as seen, nothing unseen', 0, null, 'allow'],
    ['never stored as seen, three unseen', 3, null, 'pause'],
  ])('%s → %s', (_case, unreadReports, ownerSeenAt, expected) => {
    expect(routineSpendGuard({ unreadReports, ownerSeenAt, limits: platform, now })).toBe(expected);
  });

  it("reads the workspace's own thresholds", () => {
    const strict = { unattendedReports: 1, unattendedAwaySeconds: 3600 };
    const guard = (unreadReports: number, ownerSeenAt: Date) =>
      routineSpendGuard({ unreadReports, ownerSeenAt, limits: strict, now });
    expect(guard(1, ago(60_000))).toBe('pause');
    expect(guard(0, ago(HOUR))).toBe('pause');
    expect(guard(0, ago(HOUR - 1))).toBe('allow');
  });
});

describe('ownerBackSince', () => {
  // A pause delivered late must not stop again what the owner's return resumed.
  it('reads the owner as back only when seen at or after the pause', () => {
    const pausedAt = ago(HOUR);
    expect(ownerBackSince(now, pausedAt)).toBe(true);
    expect(ownerBackSince(pausedAt, pausedAt)).toBe(true);
    expect(ownerBackSince(ago(2 * HOUR), pausedAt)).toBe(false);
    expect(ownerBackSince(null, pausedAt)).toBe(false);
  });
});
