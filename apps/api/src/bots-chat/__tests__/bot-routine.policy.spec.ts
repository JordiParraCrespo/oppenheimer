/**
 * What a bot's chat says about its routines outside any turn
 * (`26-bot-routines.md` §4, "In the chat"): which run outcomes are failures
 * worth a line, the line itself, and which failures share one line. The listener that writes it is
 * `bot-routine-activity.domain-event-handler.spec.ts`; the column and its
 * check are the integration suite's.
 */
import { AUTOMATION_SKIP_REASONS } from '@oppenheimer/shared/automations';
import {
  type RoutineActivity,
  routineActivityLine,
  routineFailureLineId,
  routineFailureOf,
} from '../domain/bot-routine.policy';

function activity(overrides: Partial<RoutineActivity> = {}): RoutineActivity {
  return {
    id: '0b6f3c9e-6a1e-4d55-9f1e-6a7b2c3d4e5f',
    organizationId: 'org-1',
    botId: 'bot-1',
    automationId: 'automation-1',
    runId: null,
    name: 'Morning PR digest',
    activity: 'saved',
    reason: null,
    at: new Date('2026-10-18T09:00:00Z'),
    ...overrides,
  };
}

describe('routineFailureOf', () => {
  // What breaks this: a line every hour for a routine the owner paused, or
  // one that is still busy with its last run, or silence for a run that
  // never started because the workspace hit its cap.
  it('reports a run that expired or could not start, and nothing a guard meant to stop', () => {
    expect(routineFailureOf('expired', null)).toBe('expired');
    const reported = AUTOMATION_SKIP_REASONS.filter((reason) =>
      routineFailureOf('skipped', reason),
    );
    expect(reported).toEqual([
      'automation_rate_limited',
      'workspace_rate_limited',
      'missed',
      'agent_unavailable',
    ]);
    expect(routineFailureOf('dispatched', null)).toBeNull();
    expect(routineFailureOf('pending', null)).toBeNull();
  });
});

describe('routineFailureLineId', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const at = (iso: string) => new Date(iso);

  // What breaks this: a burst of new mail past the hourly cap writing one
  // identical "did not start" line per message into the chat.
  it('gives every run a rate limit refuses in one hour of one routine the same line', () => {
    const first = routineFailureLineId(
      'event-1',
      'automation-1',
      'automation_rate_limited',
      at('2026-11-03T09:01:00Z'),
    );
    expect(first).toMatch(UUID);
    expect(
      routineFailureLineId(
        'event-2',
        'automation-1',
        'automation_rate_limited',
        at('2026-11-03T09:59:59Z'),
      ),
    ).toBe(first);
  });

  it('starts a new line for the next hour, another routine, or the other cap', () => {
    const first = routineFailureLineId(
      'event-1',
      'automation-1',
      'automation_rate_limited',
      at('2026-11-03T09:01:00Z'),
    );
    const others = [
      routineFailureLineId(
        'e',
        'automation-1',
        'automation_rate_limited',
        at('2026-11-03T10:00:00Z'),
      ),
      routineFailureLineId(
        'e',
        'automation-2',
        'automation_rate_limited',
        at('2026-11-03T09:01:00Z'),
      ),
      routineFailureLineId(
        'e',
        'automation-1',
        'workspace_rate_limited',
        at('2026-11-03T09:01:00Z'),
      ),
    ];
    expect(new Set([first, ...others]).size).toBe(4);
  });

  it('keeps every other failure its own line, keyed by its event', () => {
    for (const reason of ['missed', 'agent_unavailable', 'expired']) {
      expect(
        routineFailureLineId('event-7', 'automation-1', reason, at('2026-11-03T09:00:00Z')),
      ).toBe('event-7');
    }
  });
});

describe('routineActivityLine', () => {
  it('is an event outside any turn, keyed and timed by what reported it, that the bot can read', () => {
    const line = routineActivityLine(
      activity({ activity: 'paused', reason: 'bot_provider_missing' }),
    );
    expect(line).toMatchObject({
      id: '0b6f3c9e-6a1e-4d55-9f1e-6a7b2c3d4e5f',
      turnId: null,
      role: 'event',
      event: {
        kind: 'routine',
        activity: 'paused',
        automationId: 'automation-1',
        runId: null,
        name: 'Morning PR digest',
        reason: 'bot_provider_missing',
      },
    });
    expect(line.createdAt).toEqual(new Date('2026-10-18T09:00:00Z'));
    expect(line.content).toContain('"Morning PR digest" was paused');
    expect(line.content).toContain('no key or sign-in');
  });

  it('names the run and its reason for a failure', () => {
    const line = routineActivityLine(
      activity({ activity: 'failed', runId: 'run-1', reason: 'workspace_rate_limited' }),
    );
    expect(line.event).toMatchObject({ activity: 'failed', runId: 'run-1' });
    expect(line.content).toBe(
      'A run of your routine "Morning PR digest" did not start (workspace_rate_limited).',
    );
  });
});
