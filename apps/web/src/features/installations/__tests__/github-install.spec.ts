import { describe, expect, it } from 'vitest';
import { parseInstallCallback } from '@/features/installations/lib/github-install';

/**
 * The install state is what ties GitHub's redirect to an install this console
 * started. The walk's prefix is the route's to strip (`first-run.spec.ts`);
 * this pins what the callback keeps once it has.
 */

const NONCE = 'kX9_mZq-4vR2tY7wB1nC3dE5fG8hJ0kLpQ6sU2xV4yA';

describe('parseInstallCallback', () => {
  it('keeps a nonce', () => {
    expect(parseInstallCallback({ installation_id: '42', code: 'abc', state: NONCE })).toEqual({
      installation_id: 42,
      code: 'abc',
      setup_action: undefined,
      state: NONCE,
    });
  });

  it('drops a state that is not a nonce', () => {
    for (const state of [
      'first-run',
      `first-run.${NONCE}`,
      'short',
      `${NONCE}!`,
      `other.${NONCE}`,
      'a'.repeat(129),
      42,
    ]) {
      expect(parseInstallCallback({ installation_id: '42', code: 'abc', state }).state).toBe(
        undefined,
      );
    }
  });

  it('handles a callback with no state at all', () => {
    expect(parseInstallCallback({ installation_id: '42', code: 'abc' })).toEqual({
      installation_id: 42,
      code: 'abc',
      setup_action: undefined,
      state: undefined,
    });
  });
});
