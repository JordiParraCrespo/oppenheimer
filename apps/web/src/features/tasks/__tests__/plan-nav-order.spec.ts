import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePlanNavOrder } from '../hooks/use-plan-nav-order';
import { PLAN_NAV_IDS, PLAN_NAV_ORDER_KEY, storedPlanNavOrder } from '../lib/plan-nav-order';

/**
 * The order a reader dragged Plan's views into comes back on the next
 * visit; anything else in storage never drops or duplicates a view, and one
 * this build added since takes its default place. A view that is off (the
 * Inbox without its flag) keeps its place while the others move around it.
 */

const DEFAULT = [...PLAN_NAV_IDS];
const store = (raw: string) => window.localStorage.setItem(PLAN_NAV_ORDER_KEY, raw);
const item = (id: string) => ({ id, data: {} });

afterEach(() => window.localStorage.clear());

describe('storedPlanNavOrder', () => {
  it('is the default order with nothing stored', () => {
    expect(storedPlanNavOrder()).toEqual(DEFAULT);
  });

  it('drops unknown and repeated ids and appends the rest', () => {
    store(JSON.stringify(['calendar', 'gone', 'calendar', 'tasks']));
    expect(storedPlanNavOrder()).toEqual(['calendar', 'tasks', 'inbox', 'milestones']);
  });

  it.each(['{not json', '{}', '"tasks"'])('falls back to the default order on %s', (raw) => {
    store(raw);
    expect(storedPlanNavOrder()).toEqual(DEFAULT);
  });
});

describe('usePlanNavOrder', () => {
  it('draws and keeps the order a drop settles on', () => {
    const { result } = renderHook(() => usePlanNavOrder(() => true));

    act(() => result.current.handlers.onDragStart(item('calendar')));
    act(() => result.current.handlers.onDragEnd({ active: item('calendar'), over: item('inbox') }));

    expect(result.current.order).toEqual(['calendar', 'inbox', 'tasks', 'milestones']);
    expect(storedPlanNavOrder()).toEqual(['calendar', 'inbox', 'tasks', 'milestones']);
  });

  it('keeps a hidden view in its place while the shown ones are reordered', () => {
    const { result } = renderHook(() => usePlanNavOrder((id) => id !== 'inbox'));
    expect(result.current.order).toEqual(['tasks', 'milestones', 'calendar']);

    act(() => result.current.handlers.onDragStart(item('calendar')));
    act(() => result.current.handlers.onDragEnd({ active: item('calendar'), over: item('tasks') }));

    expect(result.current.order).toEqual(['calendar', 'tasks', 'milestones']);
    expect(storedPlanNavOrder()).toEqual(['inbox', 'calendar', 'tasks', 'milestones']);
  });

  it('keeps the order when a drag is cancelled', () => {
    const { result } = renderHook(() => usePlanNavOrder(() => true));
    act(() => result.current.handlers.onDragStart(item('tasks')));
    act(() => result.current.handlers.onDragCancel());
    expect(result.current.order).toEqual(DEFAULT);
  });
});
