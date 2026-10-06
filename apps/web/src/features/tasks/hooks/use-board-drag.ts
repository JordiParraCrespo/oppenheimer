import { type SortableGroups, useSortableGroups } from '@oppenheimer/design-system-web';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { useRef, useState } from 'react';

/**
 * The board's columns as the drag layer moves them. Between drops the
 * columns are the board's read; while a card is held they are the layer's
 * live value, so the slot opens where the card is and the neighbours slide.
 * A drop hands the move to `onMove` as the column and the card it now sits
 * under (`null` at the top), which is what the API places it by, and the
 * board goes back to its read, which the move has already written.
 */
export function useBoardDrag(
  columns: SortableGroups,
  onMove: (move: { id: string; status: TaskStatus; afterTaskId: string | null }) => void,
) {
  const [live, setLive] = useState<SortableGroups | null>(null);
  // The value the drop settled on, read by the move that follows it in the same handler.
  const settled = useRef<SortableGroups>(columns);
  const groups = live ?? columns;
  const sortable = useSortableGroups(
    groups,
    (next) => {
      settled.current = next;
      setLive(next);
    },
    ({ id, to, index }) => {
      const above = settled.current[to]?.[index - 1] ?? null;
      onMove({ id, status: to as TaskStatus, afterTaskId: above });
    },
  );

  return {
    groups,
    handlers: {
      ...sortable,
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
