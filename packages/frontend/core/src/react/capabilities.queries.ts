'use client';

import type { ClientDeployment } from '@oppenheimer/shared';
import { type UseQueryOptions } from '@tanstack/react-query';
import { CORE_CONFIG } from '../config';
import { useOppenheimerApp } from './context';
import { useQuery, useSuspenseQuery } from './query';

export const capabilitiesKeys = {
  all: ['capabilities'] as const,
  deployment: () => [...capabilitiesKeys.all, 'deployment'] as const,
  version: () => [...capabilitiesKeys.all, 'version'] as const,
};

/**
 * Which client-facing optional features (OAuth providers, the GitHub App) the
 * deployment has configured, from `GET /health/capabilities`, to hide UI this
 * install cannot serve. It changes only on reconfigure and restart, so it is
 * static for a page's lifetime.
 *
 * An *error* means the API was unreachable, not that a capability is missing:
 * treating it as an empty set would hide every provider on a deployment that
 * has them all — a login page with no way in.
 */
export function useDeploymentCapabilities<TData = ClientDeployment>(
  options?: Omit<UseQueryOptions<ClientDeployment, Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: capabilitiesKeys.deployment(),
    queryFn: () => app.capabilities.get(),
    staleTime: CORE_CONFIG.query.capabilitiesStaleMs,
    ...options,
  });
}

/**
 * The release the API runs, from `GET /health/version`, for Settings → About.
 * Read under Suspense: the kit's `QueryState` draws its loading and first
 * failure. Like the capabilities it changes only on a redeploy.
 */
export function useSuspenseApiVersion() {
  const app = useOppenheimerApp();

  return useSuspenseQuery({
    queryKey: capabilitiesKeys.version(),
    queryFn: () => app.capabilities.getVersion(),
    staleTime: CORE_CONFIG.query.capabilitiesStaleMs,
  });
}
