'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { UseQueryOptions } from '@tanstack/react-query';
import type { PermissionCatalog } from '../modules/api-tokens/permission-catalog';
import { useConsumerApp } from './context';

/** Query key factory for the `apiTokens` feature. */
export const apiTokensKeys = {
  all: ['apiTokens'] as const,
  permissions: () => [...apiTokensKeys.all, 'permissions'] as const,
};

/**
 * The permission catalog and the subset the signed-in user may grant. Cached
 * for a while: it only changes when someone's roles change.
 */
export function usePermissionCatalog(
  options?: Omit<UseQueryOptions<PermissionCatalog, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: apiTokensKeys.permissions(),
    queryFn: () => app.apiTokens.permissions(),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}
