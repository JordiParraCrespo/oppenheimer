import { describe, expect, it } from 'vitest';
import { failureReason } from './start-failure';

describe('failureReason', () => {
  const translateCode = (code: string) =>
    code === 'GIT_004' ? 'Git refused the token' : undefined;
  const fallback = 'the caller’s fallback';

  it('says a code it knows in the reader’s words, with the host’s detail beside it', () => {
    expect(
      failureReason({ code: 'GIT_004', detail: 'auth failed' }, translateCode, fallback),
    ).toEqual({ reason: 'Git refused the token', detail: 'auth failed' });
  });

  it('never makes the host’s English the reason, only its detail', () => {
    expect(
      failureReason({ code: 'RUNNER_012', detail: 'clone refused' }, translateCode, fallback),
    ).toEqual({ reason: fallback, detail: 'clone refused' });
    expect(failureReason({ code: null, detail: 'boom' }, translateCode, fallback)?.reason).toBe(
      fallback,
    );
    expect(failureReason(null, translateCode, fallback)).toBeNull();
  });
});
