import { CLOUD_AGENT_STATUSES } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { cloudRunLogEntries } from '../domain/cloud-session-sync.policy';
import { sessionGroup } from '../domain/session-group.policy';
import { foldSessionEvent, INITIAL_SESSION_FOLD } from '../domain/session-state.policy';

/**
 * What a vendor's status writes to a cloud session's log, read through the
 * real fold and group: the sidebar dot a cloud session shows for each status.
 */

function groupAfter(status: (typeof CLOUD_AGENT_STATUSES)[number]) {
  const at = new Date('2026-10-27T12:00:00Z');
  const fold = [
    { kind: 'session.requested', payload: {} },
    ...cloudRunLogEntries('run-1', status),
  ].reduce(
    (current, entry, index) =>
      foldSessionEvent(current, {
        seq: index + 1,
        kind: entry.kind,
        payload: entry.payload ?? {},
        occurredAt: at,
      }),
    INITIAL_SESSION_FOLD,
  );
  return { state: fold.state, stopped: fold.stoppedAt !== null, group: sessionGroup(fold, at) };
}

describe('cloudRunLogEntries', () => {
  it.each([
    ['starting', { state: 'starting', stopped: false, group: 'idle' }],
    ['running', { state: 'open', stopped: false, group: 'working' }],
    ['finished', { state: 'open', stopped: false, group: 'idle' }],
    ['failed', { state: 'failed', stopped: false, group: 'waiting-on-you' }],
    ['expired', { state: 'failed', stopped: false, group: 'waiting-on-you' }],
    ['cancelled', { state: 'starting', stopped: true, group: 'idle' }],
  ] as const)('folds a run that is %s', (status, expected) => {
    expect(groupAfter(status)).toEqual(expected);
  });

  it('keys each entry by its run and fact, so a status read twice lands once', () => {
    expect(cloudRunLogEntries('run-1', 'finished')).toEqual(
      cloudRunLogEntries('run-1', 'finished'),
    );
    expect(cloudRunLogEntries('run-2', 'finished')[0].idempotencyKey).toBe('cloud:run-2:started');
  });
});
