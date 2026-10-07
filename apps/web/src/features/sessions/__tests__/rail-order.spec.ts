import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRailOrder } from '../hooks/use-rail-order';
import { RAIL, RAIL_ORDER_KEY, rememberRailOrder, storedRailOrder } from '../lib/rail-order';

/**
 * The rail's order a reader dragged comes back on the next visit; anything
 * else in storage — an unknown item, a repeat, a broken or non-list value —
 * never drops or duplicates an item, and one this build added since takes
 * its default place.
 */

const DEFAULT = RAIL.map((entry) => entry.id);
const store = (raw: string) => window.localStorage.setItem(RAIL_ORDER_KEY, raw);

afterEach(() => window.localStorage.clear());

describe('storedRailOrder', () => {
  it('is the default order with nothing stored', () => {
    expect(storedRailOrder()).toEqual(DEFAULT);
  });

  it('restores the order a drop remembered', () => {
    rememberRailOrder(['plan', 'sessions', 'automations', 'pulls']);
    expect(storedRailOrder()).toEqual(['plan', 'sessions', 'automations', 'pulls']);
  });

  it('drops unknown and repeated ids and appends items the stored order lacks', () => {
    store(JSON.stringify(['automations', 'gone', 'automations', 'plan']));
    expect(storedRailOrder()).toEqual(['automations', 'plan', 'sessions', 'pulls']);
  });

  it.each(['{not json', '{}', '"plan"'])('falls back to the default order on %s', (raw) => {
    store(raw);
    expect(storedRailOrder()).toEqual(DEFAULT);
  });
});

describe('useRailOrder', () => {
  it('draws and keeps the order a drop settles on', () => {
    const { result } = renderHook(() => useRailOrder());
    const item = (id: string) => ({ id, data: {} });

    act(() => result.current.handlers.onDragStart(item('plan')));
    act(() => result.current.handlers.onDragEnd({ active: item('plan'), over: item('sessions') }));

    expect(result.current.order).toEqual(['plan', 'sessions', 'pulls', 'automations']);
    expect(storedRailOrder()).toEqual(['plan', 'sessions', 'pulls', 'automations']);
  });

  it('keeps the order when a drag is cancelled', () => {
    const { result } = renderHook(() => useRailOrder());
    act(() => result.current.handlers.onDragStart({ id: 'plan', data: {} }));
    act(() => result.current.handlers.onDragCancel());
    expect(result.current.order).toEqual(DEFAULT);
  });
});
