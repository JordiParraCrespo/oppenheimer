import { createFileRoute, redirect } from '@tanstack/react-router';
import { railLanding } from '@/features/sessions/lib/rail-order';

/**
 * The console's front door, and the landing every "go to the console" points
 * at: the first list of the reader's rail (`railLanding`). `replace`, so Back
 * never returns to an address that only redirects.
 */
export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: railLanding(), replace: true });
    }
    throw redirect({ to: '/login' });
  },
});
