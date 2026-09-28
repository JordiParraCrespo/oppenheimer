import { describe, expect, it } from 'vitest';
import { loginSearchSchema, registerSearchSchema, resetPasswordSearchSchema } from '../lib/search';

/**
 * The auth screens' searches are typed by people and by other sites. The one
 * that matters most is sign-in's `redirect`: it is followed straight after a
 * password is typed, so anything that leaves the origin must read as absent.
 */

describe('loginSearchSchema', () => {
  it('keeps a same-origin path with its query', () => {
    expect(loginSearchSchema.parse({ redirect: '/sessions?host=h1' }).redirect).toBe(
      '/sessions?host=h1',
    );
  });

  it('drops a redirect that would leave the origin', () => {
    for (const redirect of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'evil.example',
      42,
    ]) {
      expect(loginSearchSchema.parse({ redirect }).redirect).toBeUndefined();
    }
  });

  it('keeps the prefill and the error code, and reads empty ones as absent', () => {
    expect(loginSearchSchema.parse({ email: 'a@b.co', error: 'signup_disabled' })).toEqual({
      redirect: undefined,
      email: 'a@b.co',
      error: 'signup_disabled',
    });
    expect(loginSearchSchema.parse({ email: '', error: '' })).toEqual({
      redirect: undefined,
      email: undefined,
      error: undefined,
    });
  });
});

describe('registerSearchSchema', () => {
  it('keeps only the error code', () => {
    expect(registerSearchSchema.parse({ error: 'signup_disabled', redirect: '/x' })).toEqual({
      error: 'signup_disabled',
    });
  });
});

describe('resetPasswordSearchSchema', () => {
  it('keeps the token, the error and the address, and never fails on a bad shape', () => {
    expect(resetPasswordSearchSchema.parse({ token: 't1', email: 'a@b.co' })).toEqual({
      token: 't1',
      error: undefined,
      email: 'a@b.co',
    });
    expect(resetPasswordSearchSchema.parse({ token: 7, error: 'INVALID_TOKEN' })).toEqual({
      token: undefined,
      error: 'INVALID_TOKEN',
      email: undefined,
    });
  });
});
