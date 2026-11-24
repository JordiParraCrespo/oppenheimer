import { useSortableGroups } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import {
  isPlanNavId,
  type PlanNavId,
  rememberPlanNavOrder,
  storedPlanNavOrder,
} from '../lib/plan-nav-order';

/** The `SortableGroup` id Plan's sidebar views sit in. */
export const PLAN_NAV_GROUP = 'plan-nav';

/**
 * Plan's sidebar views in the reader's order. The drag layer hands back the
 * new order on the drop (and the old one on a cancel); that value is drawn
 * and kept on this device. Spread `handlers` on the nav's `DragProvider`.
 */
export function usePlanNavOrder() {
  const [order, setOrder] = useState<readonly PlanNavId[]>(storedPlanNavOrder);
  const handlers = useSortableGroups({ [PLAN_NAV_GROUP]: order }, (next) => {
    const settled = (next[PLAN_NAV_GROUP] ?? []).filter(isPlanNavId);
    setOrder(settled);
    rememberPlanNavOrder(settled);
  });
  return { order, handlers };
}
