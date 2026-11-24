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
 * its default place, but the Inbox, which leads an order stored before it
 * was a rail item again. The console opens on the first item: the Inbox,
 * unless the reader dragged another above it.
 */

const DEFAULT = RAIL_ROUTES.map((item) => item.id);
const store = (raw: string) => window.localStorage.setItem(RAIL_ORDER_KEY, raw);

afterEach(() => window.localStorage.clear());

describe('storedRailOrder', () => {
  it('is the default order with nothing stored', () => {
    expect(storedRailOrder()).toEqual(DEFAULT);
  });

  it('restores the order a drop remembered', () => {
    rememberRailOrder(['plan', 'sessions', 'inbox', 'automations', 'bots', 'pulls']);
    expect(storedRailOrder()).toEqual([
      'plan',
      'sessions',
      'inbox',
      'automations',
      'bots',
      'pulls',
    ]);
  });

  it('drops unknown and repeated ids and appends the rest, the Inbox at the front', () => {
    store(JSON.stringify(['automations', 'gone', 'automations', 'plan']));
    expect(storedRailOrder()).toEqual([
      'inbox',
      'automations',
      'plan',
      'bots',
      'sessions',
      'pulls',
    ]);
  });

  it.each(['{not json', '{}', '"plan"'])('falls back to the default order on %s', (raw) => {
    store(raw);
    expect(storedRailOrder()).toEqual(DEFAULT);
  });
});

describe('railLanding', () => {
  it('opens on the Inbox for a reader who never dragged', () => {
    expect(railLanding()).toBe('/inbox');
  });

  it('opens on the Inbox for an order stored while it was in Plan', () => {
    store(JSON.stringify(['pulls', 'bots', 'sessions', 'automations', 'plan']));
    expect(railLanding()).toBe('/inbox');
  });

  it('opens on the item the reader dragged to the top', () => {
    rememberRailOrder(['pulls', 'inbox', 'bots', 'sessions', 'automations', 'plan']);
    expect(railLanding()).toBe('/pulls');
  });
});

describe('useRailOrder', () => {
  it('draws and keeps the order a drop settles on', () => {
    const { result } = renderHook(() => useRailOrder());
    const item = (id: string) => ({ id, data: {} });

    act(() => result.current.handlers.onDragStart(item('plan')));
    act(() => result.current.handlers.onDragEnd({ active: item('plan'), over: item('sessions') }));

    expect(result.current.order).toEqual([
      'inbox',
      'bots',
      'plan',
      'sessions',
      'pulls',
      'automations',
    ]);
    expect(storedRailOrder()).toEqual([
      'inbox',
      'bots',
      'plan',
      'sessions',
      'pulls',
      'automations',
    ]);
  });

  it('keeps the order when a drag is cancelled', () => {
    const { result } = renderHook(() => useRailOrder());
    act(() => result.current.handlers.onDragStart({ id: 'plan', data: {} }));
    act(() => result.current.handlers.onDragCancel());
    expect(result.current.order).toEqual(DEFAULT);
  });
});
