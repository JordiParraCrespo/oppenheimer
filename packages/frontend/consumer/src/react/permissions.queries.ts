'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { UseQueryOptions } from '@tanstack/react-query';
import { CONSUMER_CONFIG } from '../config';
import type { PermissionCatalog } from '../modules/permissions/permission-catalog';
import { useConsumerApp } from './context';

const permissionsKeys = {
  all: ['permissions'] as const,
  catalog: () => [...permissionsKeys.all, 'catalog'] as const,
};

/**
 * The permission catalog and the subset the signed-in user may grant, which
 * OAuth consent names a client's scopes from. Cached for a while: it only
 * changes when someone's roles change.
 */
export function usePermissionCatalog(
  options?: Omit<UseQueryOptions<PermissionCatalog, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: permissionsKeys.catalog(),
    queryFn: () => app.permissions.catalog(),
    staleTime: CONSUMER_CONFIG.permissions.catalogStaleMs,
    ...options,
  });
}
