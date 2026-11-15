/**
 * When a bot's heartbeat beats (`26-bot-routines.md` §6). What breaks this:
 * a beat with nothing new since the last one spending a model turn to say
 * nothing, a first beat or one after real activity skipped, or the owner's
 * Run now or a run an event trigger fired dropped. Which turns count as
 * activity is the repository's read, in `bots-chat.integration.spec.ts`.
 */
import { type HeartbeatView, heartbeatIsIdle } from '../domain/bot-heartbeat.policy';

const at = (iso: string) => new Date(iso);
const view = (patch: Partial<HeartbeatView> = {}): HeartbeatView => ({
  lastBeatAt: at('2026-11-15T09:00:00Z'),
  lastActivityAt: at('2026-11-15T08:00:00Z'),
  ...patch,
});

describe('heartbeatIsIdle', () => {
  it('skips a beat with nothing new since the last one', () => {
    expect(heartbeatIsIdle('schedule', view())).toBe(true);
    expect(heartbeatIsIdle('schedule', view({ lastActivityAt: null }))).toBe(true);
  });

  it('beats when something happened since the last beat', () => {
    expect(heartbeatIsIdle('schedule', view({ lastActivityAt: at('2026-11-15T12:00:00Z') }))).toBe(
      false,
    );
  });

  it('beats the first time, with no beat before it', () => {
    expect(heartbeatIsIdle('schedule', view({ lastBeatAt: null, lastActivityAt: null }))).toBe(
      false,
    );
  });

  it('never skips the owner’s Run now, nor a run an event fired', () => {
    expect(heartbeatIsIdle('manual', view())).toBe(false);
    expect(heartbeatIsIdle('event', view())).toBe(false);
  });
});
