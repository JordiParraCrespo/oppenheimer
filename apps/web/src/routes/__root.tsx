import { Button } from '@oppenheimer/design-system-web';
import { PageViewTracker, RouteError, RouteNotFound } from '@oppenheimer/frontend-web';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { RouterContext } from '@/app';

/**
 * `NuqsAdapter` is what lets `useQueryStates` read and write the URL, and it
 * has to sit *inside* the router — it works by calling the router's own
 * `useLocation` and `navigate`, so mounting it around `RouterProvider` in
 * `app.tsx` would throw. The root route's component is the first place inside.
 *
 * A route that declares `validateSearch` must let unknown keys through, or the
 * next navigation strips whatever nuqs wrote; `/login` is the one that does
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

/**
 * The last resort, for a URL that matched no route at all and for anything
 * thrown above the layouts — a signed-out reader on a mistyped link, a chunk
 * that would not load. Inside the product these are the `_authenticated`
 * layout's, which keeps the sidebar; there is no chrome to keep out here, so
 * the page is the message and the way back is `/`, which knows whether that
 * means the console or sign-in.
 */
function RootFallback({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col justify-center bg-canvas px-6 py-10">{children}</div>
  );
}

function RootNotFound() {
  const { t } = useTranslation();

  return (
    <RootFallback>
      <RouteNotFound>
        <Button variant="secondary" render={<Link to="/" />}>
          {t('errors.notFound.home')}
        </Button>
      </RouteNotFound>
    </RootFallback>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: (props) => (
    <RootFallback>
      <RouteError {...props} />
    </RootFallback>
  ),
  notFoundComponent: RootNotFound,
});
