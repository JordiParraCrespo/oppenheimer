import { useSortableGroups } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import {
  PLAN_NAV_IDS,
  type PlanNavId,
  rememberPlanNavOrder,
  storedPlanNavOrder,
} from '../lib/plan-nav-order';

/** The `SortableGroup` id Plan's sidebar views sit in. */
export const PLAN_NAV_GROUP = 'plan-nav';

const IDS = new Set<string>(PLAN_NAV_IDS);

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
    const moved = (next[PLAN_NAV_GROUP] ?? []).filter((id): id is PlanNavId => IDS.has(id));
    // A hidden view keeps the slot it had: the visible ones fill the others in their new order.
    let at = 0;
    const settled = order.map((id) => (shown(id) ? (moved[at++] ?? id) : id));
    setOrder(settled);
    rememberPlanNavOrder(settled);
  });
  return { order: visible, handlers };
}
