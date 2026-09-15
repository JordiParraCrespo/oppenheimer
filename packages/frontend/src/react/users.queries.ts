'use client';

import type { PermissionDefinition, Role, UpdateUserDto } from '@oppenheimer/shared';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { UserEntity } from '../modules/users/user.entity';
import { useOppenheimerApp } from './context';

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
  detail: (id: string) => [...usersKeys.details(), id] as const,
  me: () => [...usersKeys.all, 'me'] as const,
  permissions: () => [...usersKeys.me(), 'permissions'] as const,
};

export const profileQueryKey = usersKeys.me();

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
  id: string,
  options?: Omit<UseQueryOptions<UserEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => app.users.findById(id),
    enabled: !!id,
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
    onSuccess: (...args) => {
      queryClient.setQueryData(usersKeys.detail(args[1].id), args[0]);
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDeleteUser(
  options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.users.delete(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}
