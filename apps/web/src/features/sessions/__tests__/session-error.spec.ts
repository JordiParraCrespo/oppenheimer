import { AppError } from '@oppenheimer/frontend-core';
import { describe, expect, it } from 'vitest';
import { isSessionNotFound } from '../lib/session-error';

const FETCH_FAILED = { code: 'SESSIONS_CLIENT_002', message: 'Failed to load the session' };

/**
 * The session route has two failures to tell apart, and they lead to opposite
 * screens: a 404 is a destination that will never exist, everything else is a
 * read worth retrying. Getting this wrong offers a retry button that can only
 * ever fail, or hides a network blip behind "that session does not exist".
 */
describe('isSessionNotFound', () => {
  it('is true for a 404 the API answered', () => {
    expect(isSessionNotFound(new AppError(FETCH_FAILED, { status: 404 }))).toBe(true);
  });

  it('is false for a server failure', () => {
    expect(isSessionNotFound(new AppError(FETCH_FAILED, { status: 503 }))).toBe(false);
  });

  // A request that never reached the API carries no status at all — the case
  // the repository used to produce for *every* failure.
  it('is false when the failure never got a status', () => {
    expect(isSessionNotFound(new AppError(FETCH_FAILED))).toBe(false);
    expect(isSessionNotFound(new Error('offline'))).toBe(false);
  });
});
