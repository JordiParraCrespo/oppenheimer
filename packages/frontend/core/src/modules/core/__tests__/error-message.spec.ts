import type { ProblemDetails } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { createErrorMessageResolver, type ErrorMessageKey } from '../error-message';
import { AppError } from '../errors';

const MESSAGES: Record<string, string> = {
  'errors.fallback': 'Something went wrong.',
  'errors.unreachable': 'Could not reach the server.',
  ORG_002: 'That organization address is already taken.',
  INVALID_EMAIL_OR_PASSWORD: 'Incorrect email or password.',
  AUTH_002: 'You do not have permission to do that.',
};

const resolve = createErrorMessageResolver({
  t: (key: ErrorMessageKey) => MESSAGES[key],
  translateCode: (code) => MESSAGES[code],
});

/** A failure as the generated api-client throws it: status + parsed body. */
const apiFailure = (problem: Partial<ProblemDetails>) => ({
  status: problem.status,
  body: { type: 'about:blank', title: 'Error', ...problem } as ProblemDetails,
});

describe('createErrorMessageResolver', () => {
  it('translates by the problem code rather than echoing the server text', () => {
    const resolved = resolve(
      apiFailure({
        status: 409,
        code: 'ORG_002',
        title: 'That organization slug is already taken',
        detail: 'Organization slug already taken',
      }),
    );

    expect(resolved.message).toBe('That organization address is already taken.');
    expect(resolved.code).toBe('ORG_002');
  });

  it('never renders the English detail, even when no translation exists', () => {
    const resolved = resolve(
      apiFailure({
        status: 404,
        code: 'ORG_999',
        detail: 'No organization with id 42',
      }),
    );

    expect(resolved.message).toBe('Something went wrong.');
    expect(resolved.message).not.toContain('42');
  });

  it('prefers the caller’s own copy over the generic fallback', () => {
    const resolved = resolve(
      apiFailure({ status: 401, code: 'UNKNOWN_CODE' }),
      'Incorrect email or password.',
    );

    expect(resolved.message).toBe('Incorrect email or password.');
  });

  it('lets a known code win over the caller’s fallback', () => {
    const resolved = resolve(apiFailure({ status: 403, code: 'AUTH_002' }), 'Login failed.');

    expect(resolved.message).toBe('You do not have permission to do that.');
  });

  it('keeps the screen’s copy for a server failure carrying no problem document', () => {
    // Better Auth's client rejects a wrong password through `AuthRequestError`:
    // a real 401, but no problem document. Treating "no document" as "could not
    // connect" told a user who mistyped their password to check their wifi.
    const wrongPassword = Object.assign(new Error('Invalid email or password'), {
      status: 401,
    });

    const resolved = resolve(wrongPassword, 'Incorrect email or password.');

    expect(resolved.message).toBe('Incorrect email or password.');
    expect(resolved.message).not.toBe('Could not reach the server.');
  });

  it('translates a Better Auth code carried on the error itself', () => {
    const wrongPassword = Object.assign(new Error('Invalid email or password'), {
      status: 401,
      code: 'INVALID_EMAIL_OR_PASSWORD',
    });

    // Beats even the screen's own copy, and is translated.
    expect(resolve(wrongPassword, 'Login failed.').message).toBe('Incorrect email or password.');
  });

  it('reports a request that never reached the API as unreachable', () => {
    // No problem document: the caller's copy would describe the wrong failure.
    const resolved = resolve(new TypeError('Failed to fetch'), 'Incorrect email or password.');

    expect(resolved.message).toBe('Could not reach the server.');
    expect(resolved.code).toBeUndefined();
  });

  it('surfaces the correlation id and field errors for the screen', () => {
    const resolved = resolve(
      apiFailure({
        status: 400,
        code: 'VALIDATION_FAILED',
        correlationId: '2b4f',
        invalidParams: [{ name: 'email', reason: 'Invalid email' }],
      }),
    );

    expect(resolved.correlationId).toBe('2b4f');
    expect(resolved.fieldErrors).toEqual({ email: 'Invalid email' });
  });

  it('passes an AppError through without re-wrapping it', () => {
    const resolved = resolve(
      new AppError(
        { code: 'FALLBACK', message: 'unused' },
        {
          problem: {
            type: 'about:blank',
            title: 'x',
            status: 403,
            code: 'AUTH_002',
          },
        },
      ),
    );

    expect(resolved.message).toBe('You do not have permission to do that.');
  });
});
