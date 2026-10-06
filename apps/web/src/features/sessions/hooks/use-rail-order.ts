import { type SortableGroups, useSortableGroups } from '@oppenheimer/design-system-web';
import { useRef, useState } from 'react';
import { type RailItemId, rememberRailOrder, storedRailOrder } from '../lib/rail-order';

const GROUP = 'rail';

/**
 * The rail's items in the reader's order, as the drag layer moves them: the
 * neighbours slide while one is held, and a drop keeps the new order on this
 * device. Spread `handlers` on the rail's `DragProvider` and the order on its
 * `SortableGroup`.
 */
export function useRailOrder() {
  const [groups, setGroups] = useState<SortableGroups>(() => ({ [GROUP]: storedRailOrder() }));
  // The value the drop settled on, read by the move that follows it in the same handler.
  const settled = useRef<SortableGroups>(groups);
  const handlers = useSortableGroups(
    groups,
    (next) => {
      settled.current = next;
      setGroups(next);
    },
    () => rememberRailOrder(settled.current[GROUP] ?? []),
  );
  return { group: GROUP, order: (groups[GROUP] ?? []) as readonly RailItemId[], handlers };
}
