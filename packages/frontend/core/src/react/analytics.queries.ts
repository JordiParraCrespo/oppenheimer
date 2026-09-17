'use client';

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type {
  AnalyticsProperties,
  FeatureFlags,
  FeatureFlagValue,
} from '../modules/analytics/analytics.client';
import type { AnalyticsEvent } from '../modules/analytics/analytics.events';
import type { AnalyticsService } from '../modules/analytics/analytics.service';
import { isFlagEnabled } from '../modules/analytics/feature-flags';
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
  flags: () => [...analyticsKeys.all, 'feature-flags'] as const,
};

/**
 * The analytics service, for the rare call this module doesn't wrap —
 * `identify()` after a profile edit, say.
 */
export function useAnalytics(): AnalyticsService {
  return useOppenheimerApp().analytics;
}

/* -------------------------------------------------------------------------- */
/*                                  Queries                                   */
/* -------------------------------------------------------------------------- */

/**
 * The provider's flag set as a TanStack Query.
 *
 * Flags are remote state fetched over the network, so they belong in the query
 * cache like any other — the provider only has to answer one async read, and
 * caching, deduplication and refetch-on-reconnect come from the query client
 * rather than from each adapter. That is what keeps the port small enough for a
 * non-PostHog provider to satisfy.
 *
 * When the provider can push flag updates this subscribes and invalidates on
 * change; when it can't, flags refresh on the query's normal schedule.
 */
export function useFeatureFlags<TData = FeatureFlags>(
  options?: Omit<UseQueryOptions<FeatureFlags, Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  useEffect(() => {
    return app.analytics.onFeatureFlags(() => {
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.flags() });
    });
  }, [app, queryClient]);

  return useQuery({
    queryKey: analyticsKeys.flags(),
    queryFn: () => app.analytics.getFeatureFlags(),
    // Flags change on the provider's dashboard, not in response to anything the
    // user did here, so refetching on every mount would be pure noise. Pushed
    // updates cover the case where staleness actually matters.
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Reads a multivariate flag's value, for A/B tests with more than two arms.
 * Returns `undefined` until flags load, and for a flag the provider doesn't
 * know about.
 */
export function useFeatureFlagValue(key: string): FeatureFlagValue {
  const { data } = useFeatureFlags({ select: (flags) => flags[key] });

  return data;
}

/**
 * Reads a boolean feature flag.
 *
 * Returns `false` until flags load, so the first render always takes the
 * control branch — never gate a destructive or paid action on a flag flipping
 * to `true` late. Use {@link useFeatureFlags} directly when you need the
 * loading state to hold rendering back instead.
 *
 * A multivariate flag reads as enabled on any variant, matching how providers
 * treat a variant string as an "on" state.
 */
export function useFeatureFlag(key: string): boolean {
  return isFlagEnabled(useFeatureFlagValue(key));
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
 * Single-page and native apps don't emit navigations the provider can see on
 * its own, so without this only the first load is ever counted. Each app wires
 * it up in its own analytics module — `PageViewTracker` on web,
 * `ScreenViewTracker` on mobile.
 */
export function usePageView(path: string): void {
  const { mutate } = useCapturePageView();

  useEffect(() => {
    mutate({ path });
  }, [mutate, path]);
}
