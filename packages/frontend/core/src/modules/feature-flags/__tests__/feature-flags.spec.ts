import { describe, expect, it } from 'vitest';
import { isFlagEnabled, resolveFlagValue } from '../feature-flags';

describe('resolveFlagValue', () => {
  it('serves what the server said', () => {
    expect(resolveFlagValue('api_token_creation', { api_token_creation: false })).toBe(false);
  });

  // Not loaded, unreachable and "this build does not know that value" are one
  // case: the catalog's safe answer.
  it('falls back to the catalog default when the answer is missing or unusable', () => {
    expect(resolveFlagValue('api_token_creation', undefined)).toBe(true);
    expect(resolveFlagValue('api_token_creation', {})).toBe(true);
    expect(resolveFlagValue('api_token_creation', { api_token_creation: 'yes' })).toBe(true);
  });
});

describe('isFlagEnabled', () => {
  it('treats true as on and false as off', () => {
    expect(isFlagEnabled(true)).toBe(true);
    expect(isFlagEnabled(false)).toBe(false);
  });

  // A variant flag has no off: reading its control arm as "on" would turn an
  // experiment into a gate everyone passes.
  it('does not treat a variant as on', () => {
    expect(isFlagEnabled('treatment')).toBe(false);
    expect(isFlagEnabled('control')).toBe(false);
  });

  it('treats an unknown value as off', () => {
    expect(isFlagEnabled(undefined)).toBe(false);
  });
});
