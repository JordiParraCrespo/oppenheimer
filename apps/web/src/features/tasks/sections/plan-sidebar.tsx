import type { ReactNode } from 'react';
import { PlanNav } from './plan-nav';

/**
 * Plan's sidebar body: its views (`PlanNav`), the section's bots (`bots`,
 * another feature's, which the route composes), then what the calendar puts
 * under them on `/plan/calendar` (`children`, its layers and accounts).
 */
export function PlanSidebar({ bots, children }: { bots?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PlanNav />
      {bots}
      {children}
    </div>
  );
}
