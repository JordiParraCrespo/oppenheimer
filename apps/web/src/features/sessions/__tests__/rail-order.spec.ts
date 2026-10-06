import { afterEach, describe, expect, it } from 'vitest';
import { RAIL_ITEMS, rememberRailOrder, storedRailOrder } from '../lib/rail-order';

/**
 * The rail's order a reader dragged comes back on the next visit; anything
 * else in storage — an unknown list, a repeat, a broken value — never drops
 * or duplicates a list, and one this build added since takes its default place.
 */

const KEY = 'oppenheimer.rail.order';

afterEach(() => window.localStorage.clear());

describe('storedRailOrder', () => {
  it('is the default order with nothing stored', () => {
    expect(storedRailOrder()).toEqual([...RAIL_ITEMS]);
  });

  it('restores the order a drop remembered', () => {
    rememberRailOrder(['plan', 'sessions', 'automations', 'pulls']);
    expect(storedRailOrder()).toEqual(['plan', 'sessions', 'automations', 'pulls']);
  });

  it('drops unknown and repeated ids and appends lists the stored order lacks', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(['automations', 'gone', 'automations', 'plan']),
    );
    expect(storedRailOrder()).toEqual(['automations', 'plan', 'sessions', 'pulls']);
  });

  it('falls back to the default order on an unreadable value', () => {
    window.localStorage.setItem(KEY, '{not json');
    expect(storedRailOrder()).toEqual([...RAIL_ITEMS]);
  });
});
