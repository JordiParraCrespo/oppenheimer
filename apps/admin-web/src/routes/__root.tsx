import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import type { RouterContext } from '@/app';
import { PageViewTracker } from '@/lib/analytics';

/**
 * `NuqsAdapter` is what lets `useQueryStates` read and write the URL, and it
 * has to sit *inside* the router — it works by calling the router's own
 * `useLocation` and `navigate`, so mounting it around `RouterProvider` in
 * `app.tsx` would throw. The root route's component is the first place inside.
 *
 * A route that declares `validateSearch` must let unknown keys through, or the
 * next navigation strips whatever nuqs wrote; `/settings` is the one that does
 * and says so there.
 */
function RootLayout() {
  return (
    <NuqsAdapter>
      <PageViewTracker />
      <Outlet />
    </NuqsAdapter>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
