'use client';

import type { PermissionDefinition, Role, UpdateUserDto } from '@oppenheimer/shared';
import {
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
    // The saved row is the answer, so it is written, not refetched. What it
    // appears in is invalidated around it — never `all`, which would mark the
    // row just written stale and fetch it again.
    ...withCacheOnSuccess(options, (user, { id }) => {
      queryClient.setQueryData(usersKeys.detail(id), user);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.me() });
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
    ...withCacheOnSuccess(options, (_, id) => {
      queryClient.removeQueries({ queryKey: usersKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      // An admin may delete their own account: the shell's "me" and its
      // permissions must not keep rendering the identity just removed.
      queryClient.invalidateQueries({ queryKey: usersKeys.me() });
    }),
  });
}
