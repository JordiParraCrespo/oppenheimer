import { createFileRoute, redirect } from '@tanstack/react-router';
import { planLanding } from '@/features/tasks/lib/plan-nav-order';

/**
 * Plan's front door, where the rail's Plan item and the console's landing
 * point: the view the reader dragged to the top of Plan's sidebar
 * (`planLanding`), the Inbox until they drag one. `replace`, so Back never
 * returns to an address that only redirects.
 */
export const Route = createFileRoute('/_authenticated/plan/open')({
  beforeLoad: () => {
    throw redirect({ to: planLanding(), replace: true });
  },
});
