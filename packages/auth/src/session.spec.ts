import { describe, expect, it } from 'vitest';
import { toAuthSession } from './session';
import { AuthRequestError, unwrap } from './unwrap';

describe('unwrap', () => {
  it('does nothing on success', () => {
    expect(() => unwrap({ error: null })).not.toThrow();
    expect(() => unwrap({})).not.toThrow();
  });

  it('throws the error message on failure', () => {
    expect(() => unwrap({ error: { message: 'Invalid credentials' } })).toThrow(
      'Invalid credentials',
    );
  });

  it('falls back to a generic message when the error has none', () => {
    expect(() => unwrap({ error: {} })).toThrow('Authentication request failed');
  });

  it('preserves the status and code so callers can tell why it failed', () => {
    // Without these a UI cannot distinguish "wrong password" (the server
    // answered 401) from "the server is unreachable" (no status at all), and
    // ends up telling someone who mistyped their password to check their wifi.
    const error = (() => {
      try {
        unwrap({
          error: {
            message: 'Invalid email or password',
            code: 'INVALID_EMAIL_OR_PASSWORD',
            status: 401,
            statusText: 'Unauthorized',
          },
        });
      } catch (e) {
        return e as AuthRequestError;
      }
    })();

    expect(error).toBeInstanceOf(AuthRequestError);
    expect(error?.status).toBe(401);
    expect(error?.code).toBe('INVALID_EMAIL_OR_PASSWORD');
    expect(error?.message).toBe('Invalid email or password');
  });
});

describe('toAuthSession', () => {
  const user = {
    id: 'u1',
    email: 'jane@example.com',
    emailVerified: true,
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'admin',
  };

  it('maps a session to the platform-agnostic shape', () => {
    expect(toAuthSession({ data: { user }, error: null })).toEqual({
      user: {
        id: 'u1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'admin',
        emailVerified: true,
      },
    });
  });

  it('defaults the additional fields when absent', () => {
    const session = toAuthSession({
      data: {
        user: { id: 'u1', email: 'jane@example.com', emailVerified: false },
      },
      error: null,
    });
    expect(session?.user).toMatchObject({
      firstName: '',
      lastName: '',
      role: 'user',
    });
  });

  it('returns null when there is no session', () => {
    expect(toAuthSession({ data: null, error: null })).toBeNull();
  });

  it('surfaces transport failures instead of returning null', () => {
    expect(() => toAuthSession({ data: null, error: { message: 'Network down' } })).toThrow(
      'Network down',
    );
    expect(() => toAuthSession({ data: null, error: {} })).toThrow('Failed to restore session');
  });
});
