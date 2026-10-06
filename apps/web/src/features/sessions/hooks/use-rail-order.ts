import { useSortableGroups } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { type RailItemId, railEntry, rememberRailOrder, storedRailOrder } from '../lib/rail-order';

/** The `SortableGroup` id the rail's items sit in. */
export const RAIL_GROUP = 'rail';

/**
 * The rail's items in the reader's order. The drag layer hands back the new
 * order on the drop (and the old one on a cancel); that value is drawn and
 * kept on this device. Spread `handlers` on the rail's `DragProvider`.
 */
export function useRailOrder() {
  const [order, setOrder] = useState<readonly RailItemId[]>(storedRailOrder);
  const handlers = useSortableGroups({ [RAIL_GROUP]: order }, (next) => {
    const settled = (next[RAIL_GROUP] ?? []).flatMap((id) => railEntry(id)?.id ?? []);
    setOrder(settled);
    rememberRailOrder(settled);
  });
  return { order, handlers };
}
