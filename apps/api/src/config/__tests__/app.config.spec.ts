/**
 * The auth secret signs every session cookie and keys the preview cookie's
 * HMAC: production must refuse to boot on the placeholder `.env.example`
 * ships, or on one short enough to guess, while development keeps working on it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from '../app.config';

afterEach(() => {
  vi.unstubAllEnvs();
});

const boot = (nodeEnv: string, secret: string) => {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.stubEnv('BETTER_AUTH_SECRET', secret);
  return () => appConfig();
};

describe('BETTER_AUTH_SECRET', () => {
  it('refuses the shipped placeholder and a short secret in production', () => {
    expect(boot('production', 'change-me-in-production')).toThrow(/BETTER_AUTH_SECRET/);
    expect(boot('production', 'x'.repeat(31))).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('boots production on a generated secret', () => {
    expect(boot('production', 'q3Xh0v8ZbKkQf2r9uY1mN5sT7wE4aD6cG8jL0pR2tV4=')).not.toThrow();
  });

  it('keeps development booting on the placeholder', () => {
    expect(boot('development', 'change-me-in-production')).not.toThrow();
  });
});
