import { describe, expect, it } from 'vitest';
import { sanitizeRedirect } from './sanitize-redirect';

// Which paths leave the origin is `isSameOriginPath`'s, tested in
// `@oppenheimer/shared`; this holds what the console does with its answer.
describe('sanitizeRedirect', () => {
  it('keeps a same-origin path, search string included', () => {
    expect(sanitizeRedirect('/settings?section=security')).toBe('/settings?section=security');
    expect(sanitizeRedirect('/sessions')).toBe('/sessions');
  });

  it('drops a path that would leave the origin, rather than rewriting it', () => {
    expect(sanitizeRedirect('https://evil.example')).toBeUndefined();
    expect(sanitizeRedirect('//evil.example')).toBeUndefined();
    expect(sanitizeRedirect('/\t/evil.example')).toBeUndefined();
  });

  it('drops anything that is not a string path', () => {
    expect(sanitizeRedirect(undefined)).toBeUndefined();
    expect(sanitizeRedirect(42)).toBeUndefined();
    expect(sanitizeRedirect('settings')).toBeUndefined();
    expect(sanitizeRedirect('')).toBeUndefined();
  });
});
