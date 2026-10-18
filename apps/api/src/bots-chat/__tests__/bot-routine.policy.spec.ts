/**
 * What a bot's chat says about its routines outside any turn
 * (`26-bot-routines.md` §4, "In the chat"): which run outcomes are failures
 * worth a line, and the line itself. The listener that writes it is
 * `bot-routine-activity.domain-event-handler.spec.ts`; the column and its
 * check are the integration suite's.
 */
import { AUTOMATION_SKIP_REASONS } from '@oppenheimer/shared/automations';
import {
  type RoutineActivity,
  routineActivityLine,
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
