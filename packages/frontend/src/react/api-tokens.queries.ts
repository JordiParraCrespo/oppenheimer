'use client';

import type { CreateApiTokenDto } from '@oppenheimer/shared';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  ApiTokenEntity,
  CreatedApiToken,
  CurrentCredential,
  PermissionCatalog,
} from '../modules/api-tokens/api-token.entity';
import { useOppenheimerApp } from './context';

/**
 * Query key factory for the `apiTokens` feature, structured from the most
 * generic (`all`) to the most specific so a whole subtree can be invalidated
 * with one key.
 */
export const apiTokensKeys = {
  all: ['apiTokens'] as const,
  lists: () => [...apiTokensKeys.all, 'list'] as const,
  list: () => [...apiTokensKeys.lists()] as const,
  permissions: () => [...apiTokensKeys.all, 'permissions'] as const,
  credential: () => [...apiTokensKeys.all, 'credential'] as const,
};

export function useApiTokens(
  options?: Omit<UseQueryOptions<ApiTokenEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: apiTokensKeys.list(),
    queryFn: () => app.apiTokens.findAll(),
    ...options,
  });
}

/**
 * The permission catalog and the subset the signed-in user may grant. Cached
 * for a while: it only changes when someone's roles change.
 */
export function usePermissionCatalog(
  options?: Omit<UseQueryOptions<PermissionCatalog, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: apiTokensKeys.permissions(),
    queryFn: () => app.apiTokens.permissions(),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useCurrentCredential(
  options?: Omit<UseQueryOptions<CurrentCredential, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: apiTokensKeys.credential(),
    queryFn: () => app.apiTokens.currentCredential(),
    ...options,
  });
}

export function useCreateApiToken(
  options?: UseMutationOptions<CreatedApiToken, Error, CreateApiTokenDto>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateApiTokenDto) => app.apiTokens.create(dto),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: apiTokensKeys.lists() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useRevokeApiToken(options?: UseMutationOptions<void, Error, string>) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.apiTokens.revoke(id),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: apiTokensKeys.lists() });
      options?.onSuccess?.(...args);
    },
  });
}
