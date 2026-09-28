import { describe, expect, it } from 'vitest';
import {
  installUrlWithState,
  isWalkState,
  parseInstallCallback,
} from '@/features/organizations/lib/github-install';

/**
 * The install state is what ties GitHub's redirect to an install this console
 * started, and the walk rides on it as a prefix. These pin both halves of the
 * round trip: what goes out on the install URL, and what the callback keeps.
 */

const NONCE = 'kX9_mZq-4vR2tY7wB1nC3dE5fG8hJ0kLpQ6sU2xV4yA';
const MINTED = `https://github.com/apps/oppenheimer/installations/new?state=${NONCE}`;

describe('parseInstallCallback', () => {
  it('keeps the nonce and nothing else of a walk’s state', () => {
    expect(
      parseInstallCallback({ installation_id: '42', code: 'abc', state: `first-run.${NONCE}` }),
    ).toEqual({ installation_id: 42, code: 'abc', setup_action: undefined, state: NONCE });
  });

  it('keeps a bare nonce', () => {
    expect(parseInstallCallback({ state: NONCE }).state).toBe(NONCE);
  });

  it('drops a state that is not a nonce', () => {
    for (const state of [
      'first-run',
      'first-run.',
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

describe('isWalkState', () => {
  it('reads the walk off the prefix, and off the legacy bare state', () => {
    expect(isWalkState(`first-run.${NONCE}`)).toBe(true);
    expect(isWalkState('first-run')).toBe(true);
    expect(isWalkState(NONCE)).toBe(false);
    expect(isWalkState(undefined)).toBe(false);
  });
});

describe('installUrlWithState', () => {
  it('leaves the minted URL alone off the walk', () => {
    expect(installUrlWithState(MINTED)).toBe(MINTED);
  });

  it('prefixes the state on the walk, keeping the rest of the query', () => {
    const url = new URL(installUrlWithState(`${MINTED}&suggested_target_id=7`, true));

    expect(url.searchParams.get('state')).toBe(`first-run.${NONCE}`);
    expect(url.searchParams.get('suggested_target_id')).toBe('7');
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/apps/oppenheimer/installations/new',
    );
  });

  it('round-trips: what the walk sends is what the callback reads back', () => {
    const sent = new URL(installUrlWithState(MINTED, true)).searchParams.get('state');

    expect(isWalkState(sent)).toBe(true);
    expect(parseInstallCallback({ state: sent }).state).toBe(NONCE);
  });

  it('hands back an address it cannot parse, or one with no state, untouched', () => {
    expect(installUrlWithState('not a url', true)).toBe('not a url');
    const bare = 'https://github.com/apps/oppenheimer/installations/new';
    expect(installUrlWithState(bare, true)).toBe(bare);
  });
});
