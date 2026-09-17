import type { ProblemDetails } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { AppError, toAppError } from '../errors';

const FETCH_FAILED = {
  code: 'USERS_CLIENT_002',
  message: 'Failed to fetch user',
};

/** What the generated api-client throws: the parsed body hangs off `body`. */
const apiError = (status: number, body: unknown) =>
  Object.assign(new Error('api'), { status, body });

const problem: ProblemDetails = {
  type: 'https://oppenheimer.dev/errors#user_001',
  title: 'User not found',
  status: 404,
  detail: 'No user with id 42',
  code: 'USER_001',
  correlationId: 'req-7',
};

describe('toAppError', () => {
  it("prefers the server's explanation over the generic fallback", () => {
    const error = toAppError(apiError(404, problem), FETCH_FAILED);

    expect(error.message).toBe('No user with id 42');
    expect(error.code).toBe('USER_001');
    expect(error.status).toBe(404);
    expect(error.correlationId).toBe('req-7');
  });

  it('falls back to the catalog message when the API said nothing useful', () => {
    const error = toAppError(new Error('Network request failed'), FETCH_FAILED);

    expect(error.message).toBe('Failed to fetch user');
    expect(error.code).toBe('USERS_CLIENT_002');
    expect(error.problem).toBeUndefined();
  });

  it('exposes validation failures keyed by field, ready for a form', () => {
    const error = toAppError(
      apiError(400, {
        title: 'Validation failed',
        status: 400,
        code: 'VALIDATION_FAILED',
        invalidParams: [
          { name: 'email', reason: 'Invalid email' },
          { name: 'firstName', reason: 'Required' },
        ],
      }),
      FETCH_FAILED,
    );

    expect(error.fieldErrors).toEqual({
      email: 'Invalid email',
      firstName: 'Required',
    });
  });

  it('passes an AppError through untouched', () => {
    const original = new AppError(FETCH_FAILED);
    expect(toAppError(original, FETCH_FAILED)).toBe(original);
  });
});
