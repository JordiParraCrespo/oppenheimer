import { usePageView } from '@oppenheimer/frontend-core/react';
import { useRouterState } from '@tanstack/react-router';

/**
 * Reports page views to analytics on every navigation: TanStack Router
 * navigations are client-side, so the provider's automatic capture only sees
 * the first hard load. It renders nothing, so the hook sits inside
 * `OppenheimerProvider`.
 *
 * The pathname only, because several routes carry secrets in the query string
 * (`/reset-password?token=…`); `stripUrlSecrets` in `posthog-client.ts` strips
 * them from the URL properties PostHog attaches to every event.
 */
export function PageViewTracker() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  usePageView(pathname);

  return null;
}
