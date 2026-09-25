'use client';

import { type UseMutationOptions, useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { AnalyticsProperties } from '../modules/analytics/analytics.client';
import type { AnalyticsEvent } from '../modules/analytics/analytics.events';
import type { AnalyticsService } from '../modules/analytics/analytics.service';
import { useOppenheimerApp } from './context';

/**
 * Query key factory for the `analytics` feature.
 *
 * Same shape as the other feature key factories: generic to specific, each
 * level derived from the one above, so `analyticsKeys.all` invalidates the
 * whole subtree.
 */
export const analyticsKeys = {
  all: ['analytics'] as const,
};

/**
 * The analytics service, for the rare call this module doesn't wrap —
 * `identify()` after a profile edit, say.
 */
export function useAnalytics(): AnalyticsService {
  return useOppenheimerApp().analytics;
}

/* -------------------------------------------------------------------------- */
/*                                 Mutations                                  */
/* -------------------------------------------------------------------------- */

export interface CaptureEventVariables {
  event: AnalyticsEvent;
  properties?: AnalyticsProperties;
}

export interface CapturePageViewVariables {
  path: string;
  properties?: AnalyticsProperties;
}

/**
 * Captures a product event.
 *
 * ```ts
 * const { mutate: capture } = useCaptureEvent();
 * <Button onPress={() => capture({ event: ANALYTICS_EVENTS.USER_SIGNED_UP })} />
 * ```
 *
 * `mutate` has a stable identity, so it's safe to pass to a memoized child or
 * list in a dependency array — which `useAnalytics().capture` is not, since read
 * off the service it loses its `this` binding.
 *
 * Note that the mutation always succeeds: `AnalyticsService` guards every
 * provider call, so a blocked or failing SDK is swallowed and warned rather
 * than surfaced. `isPending` and `error` are there for interface consistency
 * with the other mutations, not because a capture is expected to fail — analytics
 * must never sit in a critical path.
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
 * Records a page or screen view. Prefer {@link usePageView}, which fires this
 * from the router; reach for the mutation directly only to record a view the
 * router can't see.
 */
export function useCapturePageView(
  options?: Omit<UseMutationOptions<void, Error, CapturePageViewVariables>, 'mutationFn'>,
) {
  const app = useOppenheimerApp();

  return useMutation({
    mutationFn: async ({ path, properties }: CapturePageViewVariables) => {
      app.analytics.pageView(path, properties);
    },
    ...options,
  });
}

/**
 * Captures an event once, when the component mounts.
 *
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

  // Read through a ref so a fresh object literal each render doesn't re-fire
  // the effect, while the capture still sends the latest values.
  const latestProperties = useRef(properties);
  latestProperties.current = properties;

  const capturedEvent = useRef<AnalyticsEvent | null>(null);

  useEffect(() => {
    if (capturedEvent.current === event) return;

    capturedEvent.current = event;
    mutate({ event, properties: latestProperties.current });
  }, [mutate, event]);
}

/**
 * Records a page view whenever `path` changes.
 *
 * Call this once, high in the tree, wired to the router's current location.
 * A single-page app doesn't emit navigations the provider can see on its own,
 * so without this only the first load is ever counted. The app wires it up in
 * its own analytics module (`PageViewTracker` on web).
 */
export function usePageView(path: string): void {
  const { mutate } = useCapturePageView();

  useEffect(() => {
    mutate({ path });
  }, [mutate, path]);
}
