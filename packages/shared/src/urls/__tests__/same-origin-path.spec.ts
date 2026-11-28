import { describe, expect, it } from 'vitest';
import { isSameOriginPath } from '../same-origin-path.js';

/**
 * The one rule the console's sign-in redirect and the API's preview path both
 * hold to: a gap here is an open redirect in both at once.
 */
describe('isSameOriginPath', () => {
  it('accepts a path on this origin, search and encoded characters included', () => {
    expect(isSameOriginPath('/')).toBe(true);
    expect(isSameOriginPath('/settings?section=security')).toBe(true);
    expect(isSameOriginPath('/docs/%09')).toBe(true);
  });

  it('refuses a protocol-relative or absolute URL, and anything not rooted at `/`', () => {
    for (const away of ['//evil.example', 'https://evil.example', 'docs', '']) {
      expect(isSameOriginPath(away)).toBe(false);
    }
  });

  it('refuses a backslash anywhere, which a browser reads as a slash', () => {
    for (const away of ['/\\evil.example', '\\\\evil.example', '/a\\b']) {
      expect(isSameOriginPath(away)).toBe(false);
    }
  });

  it('refuses a control character or DEL, which a browser strips to read `//`', () => {
    for (const away of [
      '/\t/evil.example',
      '/\n/evil.example',
      '/\r/evil.example',
      '/\u0000x',
      '/\u007fx',
    ]) {
      expect(isSameOriginPath(away)).toBe(false);
    }
  });
});
