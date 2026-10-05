import { PageViewTracker } from '@oppenheimer/frontend-web';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { RouterContext } from '@/app';
import { RootErrorScreen } from '@/features/public/screens/root-error';
import { RootNotFoundScreen } from '@/features/public/screens/root-not-found';

/** Every route, and the page-view tracker the router's location drives. */
function RootLayout() {
  return (
    <>
      <PageViewTracker />
      <Outlet />
    </>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootErrorScreen,
  notFoundComponent: RootNotFoundScreen,
});
