'use client';

import type { PermissionDefinition, Role, UpdateUserDto } from '@oppenheimer/shared';
import {
  type QueryClient,
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { UserEntity } from '../modules/users/user.entity';
import { useOppenheimerApp } from './context';
import { withCacheOnSuccess } from './mutations';

export interface UsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
}

/**
 * Query key factory for the `users` feature.
 *
 * Keys are structured from the most generic (`all`) to the most specific
 * (`detail(id)`), and every level is derived from the one above it by
 * spreading. This keeps the hierarchy consistent and lets you invalidate a
 * whole subtree with a single key (e.g. `usersKeys.lists()` matches every
 * list query regardless of its params). See the "React Query keys" guide in
 * the docs for the rationale.
 */
export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (params?: UsersListParams) => [...usersKeys.lists(), params] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: string | undefined) => [...usersKeys.details(), id] as const,
  me: () => [...usersKeys.all, 'me'] as const,
  permissions: () => [...usersKeys.me(), 'permissions'] as const,
};

/** Whether `id` is the signed-in user, as far as the cache knows. */
function isCaller(queryClient: QueryClient, id: string): boolean {
  return queryClient.getQueryData<UserEntity>(usersKeys.me())?.id === id;
}

/**
 * The caller's own effective permissions (CASL rules), used to gate which
 * routes appear in the app's navigation. Kept alongside the profile query so
 * the shell can build the signed-in user's ability once and share it.
 */
export function useMyPermissions(
  options?: Omit<UseQueryOptions<PermissionDefinition[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: usersKeys.permissions(),
    queryFn: () => app.users.myPermissions(),
    ...options,
  });
}

export function useProfile(
  options?: Omit<UseQueryOptions<UserEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: usersKeys.me(),
    queryFn: () => app.users.me(),
    ...options,
  });
}

export function useUsers(
  params?: UsersListParams,
  options?: Omit<
    UseQueryOptions<
      {
        data: UserEntity[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      },
      Error
    >,
    'queryKey' | 'queryFn'
  >,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => app.users.findAll(params?.page, params?.limit, params?.search, params?.role),
    ...options,
  });
}

export function useUser(
  id: string | undefined,
  options?: Omit<UseQueryOptions<UserEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: id ? () => app.users.findById(id) : skipToken,
    ...options,
  });
}

export function useUpdateUser(
  options?: Omit<
    UseMutationOptions<UserEntity, Error, { id: string; dto: UpdateUserDto }>,
    'mutationFn'
  >,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => app.users.update(id, dto),
    // Write the row the server answered with, where it is cached: its detail,
    // and the caller's own entry when the row is the caller. The lists it
    // appears in are refetched. `UpdateUserDto` cannot touch roles, so the
    // permissions under `me()` stay as they are.
    ...withCacheOnSuccess(options, (user, { id }) => {
      queryClient.setQueryData(usersKeys.detail(id), user);
      if (isCaller(queryClient, id)) queryClient.setQueryData(usersKeys.me(), user);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    }),
  });
}

export function useDeleteUser(
  options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.users.delete(id),
    // The row is gone, so its detail is dropped rather than refetched. An
    // admin may delete their own account: then the caller's entry and its
    // permissions go too, or the shell keeps rendering the identity just
    // removed.
    ...withCacheOnSuccess(options, (_, id) => {
      queryClient.removeQueries({ queryKey: usersKeys.detail(id) });
      if (isCaller(queryClient, id)) queryClient.removeQueries({ queryKey: usersKeys.me() });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    }),
  });
}
