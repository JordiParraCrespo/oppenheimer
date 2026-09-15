import { describe, expect, it } from 'vitest';
import { sanitizeRedirect } from './sanitize-redirect';

describe('sanitizeRedirect', () => {
  it('keeps a same-origin path, search string included', () => {
    expect(sanitizeRedirect('/settings?section=security')).toBe('/settings?section=security');
    expect(sanitizeRedirect('/dashboard')).toBe('/dashboard');
  });

  it('drops an absolute URL', () => {
    expect(sanitizeRedirect('https://evil.example')).toBeUndefined();
    expect(sanitizeRedirect('http://evil.example/login')).toBeUndefined();
  });

  it('drops a protocol-relative URL', () => {
    expect(sanitizeRedirect('//evil.example')).toBeUndefined();
    expect(sanitizeRedirect('/\\evil.example')).toBeUndefined();
  });

  it('drops anything that is not a string path', () => {
    expect(sanitizeRedirect(undefined)).toBeUndefined();
    expect(sanitizeRedirect(42)).toBeUndefined();
    expect(sanitizeRedirect('settings')).toBeUndefined();
    expect(sanitizeRedirect('')).toBeUndefined();
  });
});
