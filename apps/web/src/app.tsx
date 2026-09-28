import { Toaster } from '@oppenheimer/design-system-web';
import { useAuthState, useSessionRestore } from '@oppenheimer/frontend-core/react';
import { AppPending, RouteError, SessionRestoreError, useTheme } from '@oppenheimer/frontend-web';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { app } from '@/lib/oppenheimer';
import { routeTree } from './routeTree.gen';

export interface RouterContext {
  auth: {
    isAuthenticated: boolean;
  };
}

const router = createRouter({
  routeTree,
  context: {
    auth: { isAuthenticated: false },
  },
  // Fetch a route's chunk when the pointer or focus lands on a link to it, so
  // the navigation itself has nothing left to download. `autoCodeSplitting`
  // puts every route in its own file, which otherwise means a click is always
  // a request; the routes carry no `loader`, so this prefetches code only.
  defaultPreload: 'intent',
  // TanStack Query owns data freshness here — every screen reads through it,
  // not through a route loader. Leaving the router's own preload cache at 30s
  // would give a second, disagreeing staleness rule the day a loader appears.
  defaultPreloadStaleTime: 0,
  // Every route catches its own render errors unless it names a boundary of
  // its own. A route without one would let the error climb to the nearest
  // ancestor that has one, and `_authenticated`'s boundary wraps the shell
  // itself — so a pane that threw took the sidebar down with it.
  defaultErrorComponent: RouteError,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Guarded routes read `context.auth` in `beforeLoad`, which only re-runs when
// the router is invalidated. The auth store is the thing that changes, so it
// tells the router directly — one subscription at module scope, instead of a
// component watching the flag and invalidating from an effect a render late.
//
// Two details keep this honest. The context is handed to the router *before*
// the invalidation, or the guards would re-run against the previous flag
// (`RouterProvider` re-applies the same context on its next render). And an
// unmounted router is left alone: session restore flips the flag before the
// provider exists, and invalidating then would run the guards with the
// initial `false` and record a redirect to /login before the app has drawn.
app.auth.store.subscribe((state, previous) => {
  if (state.isAuthenticated === previous.isAuthenticated) return;
  router.update({ context: { auth: { isAuthenticated: state.isAuthenticated } } });
  if (router.state.matches.length > 0) router.invalidate();
});

/**
 * The app's root: the router, once the session is known, and the single
 * `Toaster`. Sonner renders every `toast()` into *every* mounted `<Toaster>`,
 * so a second one anywhere in the tree shows each toast twice — mount it here
 * and nowhere else.
 */
export function App() {
  // The design system's `Toaster` reads `next-themes`, which this app does not
  // run — left to itself it would fall back to `system` and light up against
  // `prefers-color-scheme` while the rest of the product follows the toggle.
  const { resolvedTheme } = useTheme();
  const { isAuthenticated } = useAuthState();
  // Rehydrate a persisted session (tokens in localStorage) before the router's
  // route guards run, so a returning/refreshing authenticated user isn't bounced
  // to /login. `isPending`, not `isLoading`: under `PersistQueryClientProvider`
  // a query sits idle while the persisted cache is restored, and `isLoading`
  // (pending *and* fetching) is false for that window. Gating on it mounted the
  // router before the session was known, so every signed-in cold load bounced
  // to /login and back. `isPending` holds until the answer is in.
  const { isPending, isError, isFetching, refetch } = useSessionRestore();

  return (
    <>
      {isPending ? (
        <AppPending />
      ) : isError ? (
        // Restoring failed: the router would treat the reader as signed out.
        <SessionRestoreError onRetry={() => refetch()} isRetrying={isFetching} />
      ) : (
        <RouterProvider router={router} context={{ auth: { isAuthenticated } }} />
      )}
      <Toaster theme={resolvedTheme} position="bottom-right" />
    </>
  );
}
