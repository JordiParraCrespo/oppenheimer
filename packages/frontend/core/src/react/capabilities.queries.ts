'use client';

import type { ClientDeployment } from '@oppenheimer/shared';
import { type UseQueryOptions } from '@tanstack/react-query';
import { CORE_CONFIG } from '../config';
import { useOppenheimerApp } from './context';
import { useQuery } from './query';

/**
 * Everything derives from `all`, and `all` itself is never handed to
 * `useQuery` — a root that is also a leaf stops meaning "everything" the day a
 * second query joins it.
 */
const capabilitiesKeys = {
  all: ['capabilities'] as const,
  deployment: () => [...capabilitiesKeys.all, 'deployment'] as const,
};

/**
 * Which client-facing optional features (OAuth providers) the deployment has
 * configured, from `GET /health/capabilities`, to hide UI this install cannot
 * serve. It changes only on reconfigure and restart, so it is static for a
 * page's lifetime. The read is public: it gates the login screen, before any
 * session exists.
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
