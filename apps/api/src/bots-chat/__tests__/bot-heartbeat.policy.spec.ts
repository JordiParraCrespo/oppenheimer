/**
 * When a bot's heartbeat beats (`26-bot-routines.md` §6). What breaks this:
 * a beat with nothing new since the last one spending a model turn to say
 * nothing, a first beat or one after real activity skipped, the owner's Run
 * now or a run an event trigger fired dropped, another routine skipped, or
 * the view read for a run that never needs it. Which turns count as activity
 * is the repository's read, in `bots-chat.integration.spec.ts`.
 */
import type { AutomationRunCause } from '@oppenheimer/shared/automations';
import { type HeartbeatView, routineIsIdle } from '../domain/bot-heartbeat.policy';

const at = (iso: string) => new Date(iso);
const view = (patch: Partial<HeartbeatView> = {}): HeartbeatView => ({
  lastBeatAt: at('2026-11-15T09:00:00Z'),
  lastActivityAt: at('2026-11-15T08:00:00Z'),
  ...patch,
});

function decide(
  cause: AutomationRunCause,
  seen: HeartbeatView = view(),
  name = 'Heartbeat',
): { idle: Promise<boolean>; reads: () => number } {
  let reads = 0;
  const idle = routineIsIdle({ name, cause }, async () => {
    reads += 1;
    return seen;
  });
  return { idle, reads: () => reads };
}

describe('routineIsIdle', () => {
  it('skips a scheduled beat with nothing new since the last one', async () => {
    await expect(decide('schedule').idle).resolves.toBe(true);
    await expect(decide('schedule', view({ lastActivityAt: null })).idle).resolves.toBe(true);
  });

  it('beats when something happened since the last beat', async () => {
    const busy = view({ lastActivityAt: at('2026-11-15T12:00:00Z') });
    await expect(decide('schedule', busy).idle).resolves.toBe(false);
  });

  it('beats the first time, with no beat before it', async () => {
    const first = view({ lastBeatAt: null, lastActivityAt: null });
    await expect(decide('schedule', first).idle).resolves.toBe(false);
  });

  it('runs the owner’s Run now, a run an event fired, and any other routine, unread', async () => {
    for (const run of [decide('manual'), decide('event'), decide('schedule', view(), 'Digest')]) {
      await expect(run.idle).resolves.toBe(false);
      expect(run.reads()).toBe(0);
    }
  });
});
