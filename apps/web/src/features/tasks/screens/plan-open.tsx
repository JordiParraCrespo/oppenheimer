import { Navigate } from '@tanstack/react-router';
import { planLanding } from '../lib/plan-nav-order';

/**
 * Plan's front door: on to the first view of Plan's sidebar in the reader's
 * order. A screen rather than a `beforeLoad` so it reads this device's order
 * when it renders. `replace`, so Back never returns to an address that only
 * redirects.
 */
export function PlanOpenScreen() {
  return <Navigate to={planLanding()} replace />;
}
