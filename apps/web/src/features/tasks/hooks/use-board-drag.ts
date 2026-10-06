import { type SortableGroups, useSortableGroups } from '@oppenheimer/design-system-web';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { useRef, useState } from 'react';

/** The columns as one comparable value, to tell when the board's read has changed. */
function keyOf(groups: SortableGroups): string {
  return JSON.stringify(groups);
}

/**
 * The board's columns as the drag layer moves them. Between drags the
 * columns are the board's read; while a card is held they are the layer's
 * live value, so the slot opens where the card is and the neighbours slide.
 * A drop hands the move to `onMove` as the column and the card it now sits
 * under (`null` at the top), which is what the API places it by.
 *
 * The dropped order stays on screen until the read changes: the move writes
 * the read a tick after the drop, and showing the read in between would put
 * the card back where it came from for a frame before it lands again. A
 * move that is refused changes the read once more, and the card slides back.
 */
export function useBoardDrag(
  columns: SortableGroups,
  onMove: (move: { id: string; status: TaskStatus; afterTaskId: string | null }) => void,
) {
  const [live, setLive] = useState<SortableGroups | null>(null);
  const [dropped, setDropped] = useState<{ groups: SortableGroups; read: string } | null>(null);
  // The value the drop settled on, read by the move that follows it in the same handler.
  const settled = useRef<SortableGroups>(columns);
  const read = keyOf(columns);
  // Once the read moves on, the dropped order has served its turn; it never comes back.
  if (dropped && dropped.read !== read) setDropped(null);
  const held = dropped && dropped.read === read ? dropped.groups : null;
  const groups = live ?? held ?? columns;
  const sortable = useSortableGroups(
    groups,
    (next) => {
      settled.current = next;
      setLive(next);
    },
    ({ id, to, index }) => {
      const above = settled.current[to]?.[index - 1] ?? null;
      setDropped({ groups: settled.current, read });
      onMove({ id, status: to as TaskStatus, afterTaskId: above });
    },
  );

  return {
    groups,
    handlers: {
      ...sortable,
      onDragStart: (active: Parameters<typeof sortable.onDragStart>[0]) => {
        setDropped(null);
        sortable.onDragStart(active);
      },
      onDragEnd: (move: Parameters<typeof sortable.onDragEnd>[0]) => {
        sortable.onDragEnd(move);
        setLive(null);
      },
      onDragCancel: () => {
        sortable.onDragCancel();
        setLive(null);
      },
    },
  };
}
