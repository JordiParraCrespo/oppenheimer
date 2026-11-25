import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePlanNavOrder } from '../hooks/use-plan-nav-order';
import {
  PLAN_NAV_IDS,
  PLAN_NAV_ORDER_KEY,
  planLanding,
  storedPlanNavOrder,
} from '../lib/plan-nav-order';

/**
 * The order a reader dragged Plan's views into comes back on the next
 * visit; anything else in storage never drops or duplicates a view, one this
 * build added since takes its default place, and Plan opens on the view at
 * the top. An order stored while the Inbox was Plan's first view reads
 * without it, and opens on the view after it.
 */

const DEFAULT = [...PLAN_NAV_IDS];
const store = (raw: string) => window.localStorage.setItem(PLAN_NAV_ORDER_KEY, raw);
const item = (id: string) => ({ id, data: {} });

afterEach(() => window.localStorage.clear());

describe('storedPlanNavOrder', () => {
  it('is the default order with nothing stored', () => {
    expect(storedPlanNavOrder()).toEqual(DEFAULT);
  });

  it('drops unknown and repeated ids, the former Inbox among them, and appends the rest', () => {
    store(JSON.stringify(['inbox', 'calendar', 'gone', 'calendar', 'tasks']));
    expect(storedPlanNavOrder()).toEqual(['calendar', 'tasks', 'todo', 'milestones', 'projects']);
  });

  it.each(['{not json', '{}', '"tasks"'])('falls back to the default order on %s', (raw) => {
    store(raw);
    expect(storedPlanNavOrder()).toEqual(DEFAULT);
  });
});

describe('planLanding', () => {
  it('opens on the board for a reader who never dragged', () => {
    expect(planLanding()).toBe('/plan');
  });

  it('opens on the view the reader dragged to the top', () => {
    store(JSON.stringify(['calendar', 'tasks', 'todo', 'milestones', 'projects']));
    expect(planLanding()).toBe('/plan/calendar');
  });

  it('opens on the view after the Inbox for an order that led with it', () => {
    store(JSON.stringify(['inbox', 'todo', 'tasks']));
    expect(planLanding()).toBe('/plan/todo');
  });
});

describe('usePlanNavOrder', () => {
  it('draws and keeps the order a drop settles on', () => {
    const { result } = renderHook(() => usePlanNavOrder());

    act(() => result.current.handlers.onDragStart(item('calendar')));
    act(() => result.current.handlers.onDragEnd({ active: item('calendar'), over: item('tasks') }));

    expect(result.current.order).toEqual(['calendar', 'tasks', 'todo', 'milestones', 'projects']);
    expect(storedPlanNavOrder()).toEqual(['calendar', 'tasks', 'todo', 'milestones', 'projects']);
  });

  it('keeps the order when a drag is cancelled', () => {
    const { result } = renderHook(() => usePlanNavOrder());
    act(() => result.current.handlers.onDragStart(item('tasks')));
    act(() => result.current.handlers.onDragCancel());
    expect(result.current.order).toEqual(DEFAULT);
  });
});
