import { usePageView } from '@oppenheimer/frontend-core/react';
import { usePathname } from 'expo-router';

/**
 * Reports screen views to analytics on every navigation.
 *
 * Expo Router doesn't emit anything the provider can observe on its own, so
 * without this the mobile app would only ever record authentication events and
 * every navigation funnel would come back empty. Renders nothing; it exists
 * purely so the hook sits inside `OppenheimerProvider`.
 *
 * The pathname only — the query string is left out for the same reason as on
 * web: routes like `/reset-password?token=…` must not send their secrets to a
 * third party.
 */
export function ScreenViewTracker() {
  usePageView(usePathname());

  return null;
}
