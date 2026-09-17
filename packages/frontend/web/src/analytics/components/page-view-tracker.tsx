import { usePageView } from '@oppenheimer/frontend-core/react';
import { useRouterState } from '@tanstack/react-router';

/**
 * Reports page views to analytics on every navigation.
 *
 * TanStack Router navigations are client-side, so the provider's own automatic
 * capture only ever sees the first hard load. Renders nothing; it exists purely
 * so the hook sits inside `OppenheimerProvider`. Mirrors `ScreenViewTracker` in the
 * mobile app.
 *
 * The pathname only — several routes carry secrets in the query string
 * (`/reset-password?token=…`). Query strings are also stripped from the URL
 * properties PostHog attaches to every event; see `stripUrlSecrets` in
 * `posthog-client.ts`, which is what actually closes that leak.
 */
export function PageViewTracker() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  usePageView(pathname);

  return null;
}
