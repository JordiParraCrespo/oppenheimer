import { useSortableGroups } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { inStoredOrder, rememberTodoOrder, storedTodoOrder } from '../lib/todo-order';

/** The `SortableGroup` id a day's To do sits in. */
export const TODO_GROUP = 'todo';

/**
 * A day's To do in the reader's order. The drag layer hands back the new
 * order on the drop (and the old one on a cancel); it is drawn and kept on
 * this device, per day. Spread `handlers` on the list's `DragProvider`.
 */
export function useTodoOrder(day: string, today: string, ids: readonly string[]) {
  const [stored, setStored] = useState<{ day: string; ids: readonly string[] }>(() => ({
    day,
    ids: storedTodoOrder(day),
  }));
  const current = stored.day === day ? stored.ids : storedTodoOrder(day);
  const order = inStoredOrder(ids, current);
  const handlers = useSortableGroups({ [TODO_GROUP]: order }, (next, { settled }) => {
    const moved = next[TODO_GROUP] ?? order;
    setStored({ day, ids: moved });
    if (settled) rememberTodoOrder(day, moved, today);
  });
  return { order, handlers };
}
