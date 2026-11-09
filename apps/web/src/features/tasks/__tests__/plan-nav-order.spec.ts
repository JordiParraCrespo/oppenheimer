import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePlanNavOrder } from '../hooks/use-plan-nav-order';
import {
  PLAN_NAV_IDS,
  PLAN_NAV_ORDER_KEY,
  planLanding,
  planViewShown,
  storedPlanNavOrder,
} from '../lib/plan-nav-order';

/**
 * The order a reader dragged Plan's views into comes back on the next
 * visit; anything else in storage never drops or duplicates a view, and one
 * this build added since takes its default place, and Plan opens on the view
 * at the top. A view that is off (the
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
    expect(storedPlanNavOrder()).toEqual([
      'calendar',
      'tasks',
      'inbox',
      'todo',
      'milestones',
      'projects',
    ]);
  });

  it.each(['{not json', '{}', '"tasks"'])('falls back to the default order on %s', (raw) => {
    store(raw);
    expect(storedPlanNavOrder()).toEqual(DEFAULT);
  });
});

describe('planLanding', () => {
  const all = planViewShown(true);

  it('opens on the Inbox for a reader who never dragged', () => {
    expect(planLanding(all)).toBe('/plan/inbox');
  });

  it('opens on the view the reader dragged to the top', () => {
    store(JSON.stringify(['calendar', 'inbox', 'tasks', 'todo', 'milestones', 'projects']));
    expect(planLanding(all)).toBe('/plan/calendar');
  });

  it('opens on the board when Tasks is on top', () => {
    store(JSON.stringify(['tasks', 'inbox']));
    expect(planLanding(all)).toBe('/plan');
  });

  it('skips a top view the sidebar hides, as the sidebar does', () => {
    store(JSON.stringify(['inbox', 'calendar', 'tasks']));
    expect(planLanding(planViewShown(false))).toBe('/plan/calendar');
  });
});

describe('usePlanNavOrder', () => {
  it('draws and keeps the order a drop settles on', () => {
    const { result } = renderHook(() => usePlanNavOrder(() => true));

    act(() => result.current.handlers.onDragStart(item('calendar')));
    act(() => result.current.handlers.onDragEnd({ active: item('calendar'), over: item('inbox') }));

    expect(result.current.order).toEqual([
      'calendar',
      'inbox',
      'tasks',
      'todo',
      'milestones',
      'projects',
    ]);
    expect(storedPlanNavOrder()).toEqual([
      'calendar',
      'inbox',
      'tasks',
      'todo',
      'milestones',
      'projects',
    ]);
  });

  it('keeps a hidden view in its place while the shown ones are reordered', () => {
    const { result } = renderHook(() => usePlanNavOrder((id) => id !== 'inbox'));
    expect(result.current.order).toEqual(['tasks', 'todo', 'milestones', 'calendar', 'projects']);

    act(() => result.current.handlers.onDragStart(item('calendar')));
    act(() => result.current.handlers.onDragEnd({ active: item('calendar'), over: item('tasks') }));

    expect(result.current.order).toEqual(['calendar', 'tasks', 'todo', 'milestones', 'projects']);
    expect(storedPlanNavOrder()).toEqual([
      'inbox',
      'calendar',
      'tasks',
      'todo',
      'milestones',
      'projects',
    ]);
  });

  it('keeps the order when a drag is cancelled', () => {
    const { result } = renderHook(() => usePlanNavOrder(() => true));
    act(() => result.current.handlers.onDragStart(item('tasks')));
    act(() => result.current.handlers.onDragCancel());
    expect(result.current.order).toEqual(DEFAULT);
  });
});
