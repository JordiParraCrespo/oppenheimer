'use client';

import type {
  BooleanFeatureFlagKey,
  ClientFeatureFlagKey,
  ClientFeatureFlags,
  FeatureFlagValueOf,
} from '@oppenheimer/shared/feature-flags';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { OppenheimerApp } from '../di/oppenheimer-app';
import { isFlagEnabled, resolveFlagValue } from '../modules/feature-flags/feature-flags';
import { useOppenheimerApp } from './context';
import { useAuthState } from './hooks';

type FlagAudience = 'signed-in' | 'anonymous';

/**
 * Query key factory for the `featureFlags` feature.
 *
 * The flags are evaluated for whoever is calling, so the key separates a
 * signed-in caller from an anonymous one: the set fetched on the login page
 * must not be what the dashboard renders after sign-in. Switching organization
 * needs nothing here — the organization switch invalidates every query — and a
 * different user is handled by the cache-owner reconciliation on session
 * restore and the cache clear on logout.
 */
export const featureFlagKeys = {
  all: ['featureFlags'] as const,
  evaluated: (audience: FlagAudience) => [...featureFlagKeys.all, 'evaluated', audience] as const,
};

/**
 * The one definition of the flags query, shared by the hook and by the
 * prefetch `useSessionRestore` starts, so the two can never disagree on key or
 * freshness.
 */
export function featureFlagsQueryOptions(app: OppenheimerApp, audience: FlagAudience) {
  return {
    queryKey: featureFlagKeys.evaluated(audience),
    queryFn: (): Promise<ClientFeatureFlags> => app.featureFlags.get(),
    // Short enough that a kill switch lands within a minute of the next focus,
    // long enough that navigating between screens does not refetch.
    staleTime: 60 * 1000,
  };
}

/**
 * The caller's evaluated flags, from `GET /v1/feature-flags`.
 *
 * Like every query this is persisted, so a cold start renders the flags the
 * app last saw — offline included — instead of flashing defaults, and a failed
 * refetch keeps the last good answer rather than reverting to defaults. It is
 * fetched as soon as the session is known (see `useSessionRestore`), and again
 * when the window regains focus — the app returns to the foreground on
 * mobile — and on reconnect, which is how a pulled kill switch reaches a
 * long-open tab without a push channel.
 *
 * Most code wants {@link useFeatureFlag} or {@link useFeatureFlagValue}; reach
 * for this when you need the loading state.
 */
export function useFeatureFlags<TData = ClientFeatureFlags>(
  options?: Omit<UseQueryOptions<ClientFeatureFlags, Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();
  const { isAuthenticated } = useAuthState();

  return useQuery({
    ...featureFlagsQueryOptions(app, isAuthenticated ? 'signed-in' : 'anonymous'),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    ...options,
  });
}

interface Latch<V> {
  key: string;
  audience: FlagAudience;
  value: V;
}

export interface FeatureFlagReadOptions {
  /**
   * Keep the first loaded value for as long as the component stays mounted
   * and reads the same key as the same audience (signed in or out), ignoring
   * later refetches. For a flow a flag must not flip in the middle of
   * — a checkout, a transfer, a multi-step form — which is what a mobile banking
   * app does with every flag on a payment screen. Off by default: a kill switch
   * should reach a screen that is already open.
   */
  sticky?: boolean;
}

/**
 * A flag's value, typed by the catalog: `boolean` for a boolean flag, the
 * union of its variants for a multivariate one.
 *
 * Before the first answer arrives — and if it never does — this is the
 * catalog's `defaultValue`, the safe branch. Reading an `experiment` flag
 * records an exposure once the server's answer is in, so experiment results
 * are attributed to the arm people actually saw.
 */
export function useFeatureFlagValue<K extends ClientFeatureFlagKey>(
  key: K,
  { sticky = false }: FeatureFlagReadOptions = {},
): FeatureFlagValueOf<K> {
  const app = useOppenheimerApp();
  const { isAuthenticated } = useAuthState();
  const audience: FlagAudience = isAuthenticated ? 'signed-in' : 'anonymous';
  const { data, isSuccess } = useFeatureFlags({
    select: (snapshot) => resolveFlagValue(key, snapshot.flags),
  });
  const live = data ?? resolveFlagValue(key, undefined);

  // Latched in state, not a ref, with what it was latched for: a different
  // key, or a sign-in or sign-out, is a different answer and latches afresh.
  // Set during render, which React allows for a value derived from what the
  // component already has.
  const [latched, setLatched] = useState<Latch<FeatureFlagValueOf<K>> | undefined>(undefined);
  const holds = latched?.key === key && latched.audience === audience;
  if (sticky && isSuccess && !holds) setLatched({ key, audience, value: live });
  const value = sticky && holds ? (latched as Latch<FeatureFlagValueOf<K>>).value : live;

  // Exposure is analytics — a system outside React — reported once the value
  // shown is the server's, not the pre-load default.
  useEffect(() => {
    if (isSuccess) app.featureFlags.recordExposure(key, value);
  }, [app, key, value, isSuccess]);

  return value;
}

/**
 * Whether a boolean flag is on. Variant flags are read with
 * {@link useFeatureFlagValue}: their control arm is a value, not an off.
 *
 * Reads the catalog default until flags load, so a new feature (default
 * `false`) stays hidden and a kill switch (default `true`) stays live — never
 * gate a destructive or paid action on a flag flipping to `true` late. Use
 * {@link useFeatureFlags} when rendering should wait for the answer instead.
 */
export function useFeatureFlag(
  key: Extract<ClientFeatureFlagKey, BooleanFeatureFlagKey>,
  options?: FeatureFlagReadOptions,
): boolean {
  return isFlagEnabled(useFeatureFlagValue(key, options));
}
