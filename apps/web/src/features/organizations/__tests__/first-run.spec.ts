import { describe, expect, it } from 'vitest';
import {
  installUrlCarryingWalk,
  isWalkState,
  parseWalk,
  stateWithoutWalk,
} from '@/features/organizations/lib/first-run';

/**
 * The first-run walk rides the install state as a prefix, so it survives the
 * round trip through github.com. These pin both halves: what goes out on the
 * install URL, and what the GitHub route reads back.
 */

const NONCE = 'kX9_mZq-4vR2tY7wB1nC3dE5fG8hJ0kLpQ6sU2xV4yA';
const MINTED = `https://github.com/apps/oppenheimer/installations/new?state=${NONCE}`;

describe('parseWalk', () => {
  it('reads the walk as the router parses it, and as a string', () => {
    expect(parseWalk({ walk: true })).toEqual({ walk: true });
    expect(parseWalk({ walk: 'true' })).toEqual({ walk: true });
    expect(parseWalk({})).toEqual({});
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

describe('stateWithoutWalk', () => {
  it('takes the prefix off and leaves anything else alone', () => {
    expect(stateWithoutWalk(`first-run.${NONCE}`)).toBe(NONCE);
    expect(stateWithoutWalk(NONCE)).toBe(NONCE);
    expect(stateWithoutWalk(42)).toBe(42);
  });
});

describe('installUrlCarryingWalk', () => {
  it('prefixes the state, keeping the rest of the query', () => {
    const url = new URL(installUrlCarryingWalk(`${MINTED}&suggested_target_id=7`));

    expect(url.searchParams.get('state')).toBe(`first-run.${NONCE}`);
    expect(url.searchParams.get('suggested_target_id')).toBe('7');
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/apps/oppenheimer/installations/new',
    );
  });

  it('round-trips: what the walk sends is what the route reads back', () => {
    const sent = new URL(installUrlCarryingWalk(MINTED)).searchParams.get('state');

    expect(isWalkState(sent)).toBe(true);
    expect(stateWithoutWalk(sent)).toBe(NONCE);
  });

  it('hands back an address it cannot parse, or one with no state, untouched', () => {
    expect(installUrlCarryingWalk('not a url')).toBe('not a url');
    const bare = 'https://github.com/apps/oppenheimer/installations/new';
    expect(installUrlCarryingWalk(bare)).toBe(bare);
  });
});
