import { useSortableGroups } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { inStoredOrder, rememberTodoOrder, storedTodoOrder } from '../lib/todo-order';

/** The `SortableGroup` id a day's To do sits in. */
export const TODO_GROUP = 'todo';

/** A ticked task kept under the row it sat under (`null`: at the top). */
interface Anchor {
  id: string;
  after: string | null;
}

/**
 * A day's To do in the reader's order. The drag layer hands back the new
 * order on the drop (and the old one on a cancel); it is drawn and kept on
 * this device, per day. Spread `handlers` on the list's `DragProvider`.
 * `hold(id)` keeps a task where it is drawn while this list is open: ticking
 * it moves it to the top of Done (or To do) on the board, and its new rank
 * would move it on the day; the rest keeps sorting as it did.
 */
export function useTodoOrder(day: string, today: string, ids: readonly string[]) {
  const [stored, setStored] = useState<{ day: string; ids: readonly string[] }>(() => ({
    day,
    ids: storedTodoOrder(day),
  }));
  const [anchors, setAnchors] = useState<{ day: string; held: readonly Anchor[] }>({
    day,
    held: [],
  });
  const current = stored.day === day ? stored.ids : storedTodoOrder(day);
  const order = anchored(inStoredOrder(ids, current), anchors.day === day ? anchors.held : []);
  const handlers = useSortableGroups({ [TODO_GROUP]: order }, (next, { settled }) => {
    const moved = next[TODO_GROUP] ?? order;
    setStored({ day, ids: moved });
    setAnchors({ day, held: [] });
    if (settled) rememberTodoOrder(day, moved, today);
  });
  const hold = (id: string) => {
    const at = order.indexOf(id);
    if (at < 0) return;
    const after = at > 0 ? (order[at - 1] ?? null) : null;
    const held = anchors.day === day ? anchors.held.filter((anchor) => anchor.id !== id) : [];
    setAnchors({ day, held: [...held, { id, after }] });
  };
  return { order, handlers, hold };
}

function anchored(order: readonly string[], held: readonly Anchor[]): string[] {
  let out = [...order];
  for (const { id, after } of held) {
    if (!out.includes(id) || (after !== null && !out.includes(after))) continue;
    out = out.filter((other) => other !== id);
    out.splice(after === null ? 0 : out.indexOf(after) + 1, 0, id);
  }
  return out;
}
