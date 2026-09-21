'use client';

import type { ClientDeployment } from '@oppenheimer/shared';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useOppenheimerApp } from './context';

/**
 * Query key factory for the `capabilities` feature. Same shape as the other
 * feature key factories: everything derives from `all`.
 */
export const capabilitiesKeys = {
  all: ['capabilities'] as const,
};

/**
 * Which client-facing optional features the deployment has configured (OAuth
 * providers), from `GET /health/capabilities`.
 *
 * Use this to hide UI for features this install cannot serve — a social
 * sign-in button for a provider with no credentials is a dead button. The set
 * only changes when the deployment is reconfigured and restarted, so it is
 * effectively static for the lifetime of a page.
 *
 * The read is public (it gates the login screen, before any session exists).
 * Note the failure semantics: an *error* here means the API was unreachable,
 * which says nothing about what is configured — callers must not treat a
 * failed read as "capability missing".
 */
export function useDeploymentCapabilities<TData = ClientDeployment>(
  options?: Omit<UseQueryOptions<ClientDeployment, Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: capabilitiesKeys.all,
    queryFn: () => app.capabilities.get(),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}
