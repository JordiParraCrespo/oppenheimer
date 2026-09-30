'use client';

import { type UseMutationOptions, useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { AnalyticsProperties } from '../modules/analytics/analytics.client';
import type { AnalyticsEvent } from '../modules/analytics/analytics.events';
import { useOppenheimerApp } from './context';

export interface CaptureEventVariables {
  event: AnalyticsEvent;
  properties?: AnalyticsProperties;
}

/**
 * ```ts
 * const { mutate: capture } = useCaptureEvent();
 * <Button onClick={() => capture({ event: ANALYTICS_EVENTS.USER_SIGNED_UP })} />
 * ```
 *
 * `mutate` has a stable identity, unlike `capture` read off the service, which
 * loses its `this` binding.
 *
 * The mutation always succeeds: `AnalyticsService` swallows and warns on every
 * provider failure, because analytics must never sit in a critical path.
 * `isPending` and `error` exist only for consistency with the other mutations.
 */
export function useCaptureEvent(
  options?: Omit<UseMutationOptions<void, Error, CaptureEventVariables>, 'mutationFn'>,
) {
  const app = useOppenheimerApp();

  return useMutation({
    mutationFn: async ({ event, properties }: CaptureEventVariables) => {
      app.analytics.capture(event, properties);
    },
    ...options,
  });
}

/**
 * For the "this was shown" family of events — an upsell appeared, an empty
 * state was reached — where the trigger is a render rather than an interaction.
 *
 * Fires once per event name, not once per render: a new `properties` object
 * every render is the normal case and must not re-fire it, so `properties` is
 * read at capture time but doesn't itself trigger one. If `event` changes the
 * new event is captured, which is what a component reused across events wants.
 */
export function useCaptureOnMount(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  const { mutate } = useCaptureEvent();

  // Kept current by an effect, not in render: a ref written during render makes
  // the React Compiler skip the whole hook. Declared first, so it runs before
  // the capture.
  const latestProperties = useRef(properties);
  useEffect(() => {
    latestProperties.current = properties;
  });

  const capturedEvent = useRef<AnalyticsEvent | null>(null);

  useEffect(() => {
    if (capturedEvent.current === event) return;

    capturedEvent.current = event;
    mutate({ event, properties: latestProperties.current });
  }, [mutate, event]);
}

/**
 * Call this once, high in the tree, wired to the router's current location.
 * A single-page app doesn't emit navigations the provider can see on its own,
 * so without this only the first load is ever counted. On web it is
 * `PageViewTracker` (`@oppenheimer/frontend-web`), rendered at the root route.
 */
export function usePageView(path: string): void {
  const app = useOppenheimerApp();

  useEffect(() => {
    app.analytics.pageView(path);
  }, [app, path]);
}
