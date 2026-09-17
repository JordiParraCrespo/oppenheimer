import { describe, expect, it } from 'vitest';
import { sanitizeUrlProperties } from '../sanitize-url-properties';

describe('sanitizeUrlProperties', () => {
  // The case that motivates this: providers attach the current location to
  // every event, so a token in the query string reaches them for free.
  it('strips a password-reset token from the current URL', () => {
    const result = sanitizeUrlProperties({
      $current_url: 'https://app.oppenheimer.dev/reset-password?token=super-secret',
    });

    expect(result.$current_url).toBe('https://app.oppenheimer.dev/reset-password');
  });

  it('strips query strings and fragments from every URL-valued property', () => {
    const result = sanitizeUrlProperties({
      $current_url: 'https://app.oppenheimer.dev/a?x=1',
      $referrer: 'http://other.example/b?y=2#frag',
      $initial_current_url: 'https://app.oppenheimer.dev/c#tab',
    });

    expect(result).toEqual({
      $current_url: 'https://app.oppenheimer.dev/a',
      $referrer: 'http://other.example/b',
      $initial_current_url: 'https://app.oppenheimer.dev/c',
    });
  });

  it('leaves non-URL values untouched', () => {
    const result = sanitizeUrlProperties({
      $pathname: '/reset-password',
      method: 'password',
      count: 3,
      enabled: true,
      missing: null,
    });

    expect(result).toEqual({
      $pathname: '/reset-password',
      method: 'password',
      count: 3,
      enabled: true,
      missing: null,
    });
  });

  it('drops a value that looks like a URL but cannot be parsed', () => {
    const result = sanitizeUrlProperties({ $current_url: 'https://' });

    expect(result.$current_url).toBeNull();
  });

  it('does not mutate the input', () => {
    const input = { $current_url: 'https://app.oppenheimer.dev/x?token=abc' };

    sanitizeUrlProperties(input);

    expect(input.$current_url).toBe('https://app.oppenheimer.dev/x?token=abc');
  });
});
