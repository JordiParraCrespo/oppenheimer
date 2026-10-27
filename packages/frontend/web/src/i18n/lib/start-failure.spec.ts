import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { failureReason } from './start-failure';

// The key itself, so an assertion reads which string.
const t = ((key: string) => key) as unknown as TFunction;

describe('failureReason', () => {
  const catalog = (code: string) => (code === 'GIT_004' ? 'errors.byCode.GIT_004' : undefined);
  const fallback = 'the caller’s fallback';

  it('says a code a person can act on in the console’s words', () => {
    expect(
      failureReason({ code: 'SESS_002', detail: 'the frame carried 2' }, t, catalog, fallback),
    ).toEqual({
      reason: 'sessions.provisioning.codes.SESS_002',
      detail: 'the frame carried 2',
    });
  });

  it('translates any other code through the shared catalog', () => {
    expect(failureReason({ code: 'GIT_004', detail: 'auth failed' }, t, catalog, fallback)).toEqual(
      {
        reason: 'errors.byCode.GIT_004',
        detail: 'auth failed',
      },
    );
  });

  it('never makes the host’s English the reason, only its detail', () => {
    expect(
      failureReason({ code: 'RUNNER_012', detail: 'clone refused' }, t, catalog, fallback),
    ).toEqual({
      reason: fallback,
      detail: 'clone refused',
    });
    expect(failureReason({ code: null, detail: 'boom' }, t, catalog, fallback)?.reason).toBe(
      fallback,
    );
    expect(failureReason(null, t, catalog, fallback)).toBeNull();
  });
});
