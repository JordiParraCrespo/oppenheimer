import { addDays } from '@oppenheimer/frontend-web';

/**
 * The order a reader dragged a day's To do into, kept on this device as
 * Plan's sidebar order is (`20-plan-calendar.md` §6): a list of task ids per
 * day. A day nobody reordered keeps the list's own order; a task the stored
 * order does not name (added or due since) keeps its place after the ones it
 * does.
 */
export const TODO_ORDER_KEY = 'oppenheimer.plan.todo.order';

/** Days older than this are dropped on the next write, so storage does not grow without end. */
const KEEP_DAYS = 60;

type Stored = Record<string, string[]>;

function readAll(): Stored {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(TODO_ORDER_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Stored = {};
    for (const [day, ids] of Object.entries(value)) {
      if (Array.isArray(ids)) out[day] = ids.filter((id): id is string => typeof id === 'string');
    }
    return out;
  } catch {
    // Storage switched off, or something unreadable: the list's own order.
    return {};
  }
}

export function storedTodoOrder(day: string): string[] {
  return readAll()[day] ?? [];
}

export function rememberTodoOrder(day: string, ids: readonly string[], today: string) {
  const oldest = addDays(today, -KEEP_DAYS);
  const kept = Object.fromEntries(Object.entries(readAll()).filter(([key]) => key >= oldest));
  try {
    window.localStorage.setItem(TODO_ORDER_KEY, JSON.stringify({ ...kept, [day]: ids }));
  } catch {
    // Private browsing or a full quota: the order holds until the page reloads.
  }
}

/** `ids` in the stored order: the stored ones first, as stored, then the rest as they came. */
export function inStoredOrder(ids: readonly string[], stored: readonly string[]): string[] {
  const present = new Set(ids);
  const first = stored.filter((id) => present.has(id));
  const placed = new Set(first);
  return [...first, ...ids.filter((id) => !placed.has(id))];
}
