import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Toaster,
} from '@oppenheimer/design-system-web';
import { useAuthState, useSessionRestore } from '@oppenheimer/frontend/react';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';
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
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/**
 * The single `Toaster` mount for the app. Sonner renders every `toast()` into
 * *every* mounted `<Toaster>`, so a second one anywhere in the tree shows each
 * toast twice — mount it here and nowhere else.
 */
export function App() {
  // The design system's `Toaster` reads `next-themes`, which this app does not
  // run — left to itself it would fall back to `system` and light up against
  // `prefers-color-scheme` while the rest of the product follows the toggle.
  const { theme } = useTheme();

  return (
    <>
      <AppRoutes />
      <Toaster theme={theme} position="bottom-right" />
    </>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuthState();
  // Rehydrate a persisted session (tokens in localStorage) before the router's
  // route guards run, so a returning/refreshing authenticated user isn't bounced
  // to /login. Mirrors the mobile root AuthGate, which gates on the same query.
  const { isLoading, isError, isFetching, refetch } = useSessionRestore();

  const context = useMemo(() => ({ auth: { isAuthenticated } }), [isAuthenticated]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-invalidate the router whenever auth state flips so guarded routes re-run
  useEffect(() => {
    router.invalidate();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div
          role="status"
          aria-label="Loading"
          className="size-8 animate-spin rounded-full border-2 border-border-subtle border-t-surface-inverse"
        />
      </div>
    );
  }

  // Restoring the session failed (network/server error). Surface it with a retry
  // instead of rendering the router, which would treat the user as
  // unauthenticated and bounce them to /login as if they'd been logged out.
  if (isError) {
    return <SessionRestoreError onRetry={() => refetch()} isRetrying={isFetching} />;
  }

  return <RouterProvider router={router} context={context} />;
}

function SessionRestoreError({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Alert variant="destructive" className="max-w-sm">
        <AlertTitle>{t('auth.session.errorTitle')}</AlertTitle>
        <AlertDescription>{t('auth.session.errorMessage')}</AlertDescription>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-3.5 w-fit"
        >
          {isRetrying ? t('auth.session.retrying') : t('auth.session.retry')}
        </Button>
      </Alert>
    </div>
  );
}
