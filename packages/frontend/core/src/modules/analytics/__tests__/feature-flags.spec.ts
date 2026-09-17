import { describe, expect, it } from 'vitest';
import { isFlagEnabled } from '../feature-flags';

describe('isFlagEnabled', () => {
  it('treats an explicitly enabled boolean flag as on', () => {
    expect(isFlagEnabled(true)).toBe(true);
  });

  it('treats an explicitly disabled boolean flag as off', () => {
    expect(isFlagEnabled(false)).toBe(false);
  });

  // A multivariate flag reports the variant name rather than `true`. Reading
  // that as "off" would silently park every experiment on its control arm.
  it('treats any multivariate variant as on', () => {
    expect(isFlagEnabled('variant-b')).toBe(true);
    expect(isFlagEnabled('control')).toBe(true);
  });

  // Both "flags haven't loaded yet" and "no such flag" arrive as `undefined`,
  // and both have to take the control branch.
  it('treats an unknown or unloaded flag as off', () => {
    expect(isFlagEnabled(undefined)).toBe(false);
  });

  // An empty-string variant is falsy in JS but is still a variant the provider
  // assigned — the check has to be an identity test, not a truthiness one.
  it('treats an empty variant string as on rather than falsy', () => {
    expect(isFlagEnabled('')).toBe(true);
  });
});
