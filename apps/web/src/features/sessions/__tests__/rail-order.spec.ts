import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRailOrder } from '../hooks/use-rail-order';
import {
  RAIL_ORDER_KEY,
  RAIL_ROUTES,
  railLanding,
  rememberRailOrder,
  storedRailOrder,
} from '../lib/rail-landing';

/**
 * The rail's order a reader dragged comes back on the next visit; anything
 * else in storage — an unknown item, a repeat, a broken or non-list value —
 * never drops or duplicates an item, and one this build added since takes
 * its default place. The console opens on whichever item leads that order.
 */

const DEFAULT = RAIL_ROUTES.map((item) => item.id);
const store = (raw: string) => window.localStorage.setItem(RAIL_ORDER_KEY, raw);

afterEach(() => window.localStorage.clear());

describe('storedRailOrder', () => {
  it('is the default order with nothing stored', () => {
    expect(storedRailOrder()).toEqual(DEFAULT);
  });

  it('restores the order a drop remembered', () => {
    rememberRailOrder(['plan', 'sessions', 'automations', 'bots', 'pulls']);
    // An item a later build added (Cloud agents) joins at the end of a stored order.
    expect(storedRailOrder()).toEqual([
      'plan',
      'sessions',
      'automations',
      'bots',
      'pulls',
      'cloud',
    ]);
  });

  it('drops unknown and repeated ids and appends items the stored order lacks', () => {
    store(JSON.stringify(['automations', 'gone', 'automations', 'plan']));
    expect(storedRailOrder()).toEqual([
      'automations',
      'plan',
      'bots',
      'sessions',
      'cloud',
      'pulls',
    ]);
  });

  it.each(['{not json', '{}', '"plan"'])('falls back to the default order on %s', (raw) => {
    store(raw);
    expect(storedRailOrder()).toEqual(DEFAULT);
  });
});

describe('railLanding', () => {
  it('opens on Employees for a reader who never dragged', () => {
    expect(railLanding()).toBe('/bots');
  });

  it('opens on the item the reader dragged to the top', () => {
    rememberRailOrder(['plan', 'bots', 'sessions', 'pulls', 'automations']);
    expect(railLanding()).toBe('/plan');
  });
});

describe('useRailOrder', () => {
  it('draws and keeps the order a drop settles on', () => {
    const { result } = renderHook(() => useRailOrder());
    const item = (id: string) => ({ id, data: {} });

    act(() => result.current.handlers.onDragStart(item('plan')));
    act(() => result.current.handlers.onDragEnd({ active: item('plan'), over: item('sessions') }));

    const dropped = ['bots', 'plan', 'sessions', 'cloud', 'pulls', 'automations'];
    expect(result.current.order).toEqual(dropped);
    expect(storedRailOrder()).toEqual(dropped);
  });

  it('keeps the order when a drag is cancelled', () => {
    const { result } = renderHook(() => useRailOrder());
    act(() => result.current.handlers.onDragStart({ id: 'plan', data: {} }));
    act(() => result.current.handlers.onDragCancel());
    expect(result.current.order).toEqual(DEFAULT);
  });
});
