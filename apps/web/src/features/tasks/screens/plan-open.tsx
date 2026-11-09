import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { Navigate } from '@tanstack/react-router';
import { planLanding, planViewShown } from '../lib/plan-nav-order';

/**
 * Plan's front door: on to the first view Plan's sidebar shows, read with the
 * same flag the sidebar reads, so a hidden Inbox is skipped. A screen rather
 * than a `beforeLoad` because the flag is a hook. `replace`, so Back never
 * returns to an address that only redirects.
 */
export function PlanOpenScreen() {
  const inbox = useFeatureFlag('inbox');
  return <Navigate to={planLanding(planViewShown(inbox))} replace />;
}
