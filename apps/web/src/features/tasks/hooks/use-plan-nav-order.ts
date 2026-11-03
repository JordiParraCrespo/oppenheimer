import { useSortableGroups } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import {
  isPlanNavId,
  mergeShownOrder,
  type PlanNavId,
  rememberPlanNavOrder,
  storedPlanNavOrder,
} from '../lib/plan-nav-order';

/** The `SortableGroup` id Plan's sidebar views sit in. */
export const PLAN_NAV_GROUP = 'plan-nav';

/**
 * Plan's sidebar views in the reader's order. The drag layer hands back the
 * new order on the drop (and the old one on a cancel); that value is drawn
 * and kept on this device. `shown` leaves out a view that is off (the Inbox
 * without its flag) while keeping its place in what is stored. Spread
 * `handlers` on the nav's `DragProvider`.
 */
export function usePlanNavOrder(shown: (id: PlanNavId) => boolean) {
  const [order, setOrder] = useState<readonly PlanNavId[]>(storedPlanNavOrder);
  const visible = order.filter(shown);
  const handlers = useSortableGroups({ [PLAN_NAV_GROUP]: visible }, (next) => {
    const moved = (next[PLAN_NAV_GROUP] ?? []).filter(isPlanNavId);
    const settled = mergeShownOrder(order, moved, shown);
    setOrder(settled);
    rememberPlanNavOrder(settled);
  });
  return { order: visible, handlers };
}
