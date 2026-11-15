/**
 * When a bot's heartbeat beats (`26-bot-routines.md` §6). What breaks this:
 * a beat at night spending a model turn nobody reads, a beat with nothing new
 * since the last one spending a turn to say nothing, a first beat or one after
 * real activity skipped, the owner's Run now refused, another schedule keeping
 * it awake, or an unknown zone throwing instead of reading UTC.
 */
import { type HeartbeatView, heartbeatSkip } from '../domain/bot-heartbeat.policy';

const at = (iso: string) => new Date(iso);
const view = (patch: Partial<HeartbeatView> = {}): HeartbeatView => ({
  lastBeatAt: at('2026-11-15T09:46:00Z'),
  lastActivityAt: at('2026-11-15T09:00:00Z'),
  ownerTimeZone: 'Europe/Madrid',
  ...patch,
});
// 11:46 in Madrid.
const noon = at('2026-11-15T10:46:00Z');

describe('heartbeatSkip', () => {
  it('skips a beat with nothing new since the last one', () => {
    expect(heartbeatSkip('schedule', view(), noon)).toBe('idle');
  });

  it('beats when something happened since the last beat', () => {
    expect(
      heartbeatSkip('schedule', view({ lastActivityAt: at('2026-11-15T10:10:00Z') }), noon),
    ).toBeNull();
  });

  it('beats the first time, with no beat before it', () => {
    expect(heartbeatSkip('schedule', view({ lastBeatAt: null, lastActivityAt: null }), noon)).toBe(
      null,
    );
  });

  it('skips outside the owner’s waking hours, on their clock', () => {
    // 22:46 in Madrid, 21:46 UTC: past the end in Madrid only.
    const late = at('2026-11-15T21:46:00Z');
    const busy = view({ lastActivityAt: at('2026-11-15T21:40:00Z') });
    expect(heartbeatSkip('schedule', busy, late)).toBe('outside_active_hours');
    expect(heartbeatSkip('schedule', { ...busy, ownerTimeZone: 'UTC' }, late)).toBeNull();
    // 07:46 in Madrid.
    expect(heartbeatSkip('schedule', busy, at('2026-11-15T06:46:00Z'))).toBe(
      'outside_active_hours',
    );
  });

  it('reads UTC when the zone is unknown or not a zone', () => {
    const night = at('2026-11-15T03:46:00Z');
    expect(heartbeatSkip('schedule', view({ ownerTimeZone: null }), night)).toBe(
      'outside_active_hours',
    );
    expect(heartbeatSkip('schedule', view({ ownerTimeZone: 'Mars/Olympus' }), night)).toBe(
      'outside_active_hours',
    );
  });

  it('never skips the owner’s Run now', () => {
    expect(heartbeatSkip('manual', view(), noon)).toBeNull();
    expect(heartbeatSkip('manual', view(), at('2026-11-15T02:00:00Z'))).toBeNull();
  });
});
