'use client';

import type { CreateRoleDto, UpdateRoleDto } from '@oppenheimer/shared';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { AuthorizationCatalog, FindRolesParams, RoleEntity, RolePage } from '../modules/roles';
import { useOppenheimerApp } from './context';
import { organizationsKeys } from './organizations.queries';
import { usersKeys } from './users.queries';

export const rolesKeys = {
  all: ['roles'] as const,
  lists: () => [...rolesKeys.all, 'list'] as const,
  // The params object is the last segment, so `lists()` stays a prefix of every
  // paged/searched variant — invalidating it clears them all at once.
  list: (params?: FindRolesParams) => [...rolesKeys.lists(), params ?? {}] as const,
  catalog: () => [...rolesKeys.all, 'catalog'] as const,
  user: (userId: string) => [...rolesKeys.all, 'user', userId] as const,
};

export function useRoles(
  params?: FindRolesParams,
  options?: Omit<UseQueryOptions<RolePage, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();
  return useQuery({
    queryKey: rolesKeys.list(params),
    queryFn: () => app.roles.findAll(params),
    ...options,
  });
}

export function useAuthorizationCatalog(
  options?: Omit<UseQueryOptions<AuthorizationCatalog, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();
  return useQuery({
    queryKey: rolesKeys.catalog(),
    queryFn: () => app.roles.catalog(),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useUserRoles(
  userId: string,
  options?: Omit<UseQueryOptions<RoleEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();
  return useQuery({
    queryKey: rolesKeys.user(userId),
    queryFn: () => app.roles.findForUser(userId),
    enabled: Boolean(userId),
    ...options,
  });
}

export function useUsersRoles(userIds: string[]) {
  const app = useOppenheimerApp();
  return useQueries({
    queries: userIds.map((userId) => ({
      queryKey: rolesKeys.user(userId),
      queryFn: () => app.roles.findForUser(userId),
      enabled: Boolean(userId),
    })),
  });
}

export function useCreateRole(options?: UseMutationOptions<RoleEntity, Error, CreateRoleDto>) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto) => app.roles.create(dto),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      options?.onSuccess?.(...args);
    },
  });
}

export function useUpdateRole(
  options?: UseMutationOptions<RoleEntity, Error, { id: string; dto: UpdateRoleDto }>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }) => app.roles.update(id, dto),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      // Editing a role's permissions can change the caller's own ability if
      // they hold it, so refresh the nav's permission set rather than let it go
      // stale until a later refocus.
      queryClient.invalidateQueries({ queryKey: usersKeys.permissions() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useDeleteRole(options?: UseMutationOptions<void, Error, string>) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => app.roles.remove(id),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      // Deleting a role the caller held narrows their ability — refresh the nav.
      queryClient.invalidateQueries({ queryKey: usersKeys.permissions() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useAssignUserRoles(
  options?: UseMutationOptions<RoleEntity[], Error, { userId: string; roleIds: string[] }>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleIds }) => app.roles.assignToUser(userId, roleIds),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: rolesKeys.user(args[1].userId),
      });
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() });
      // The team table's role facet is answered by the members endpoint, so a
      // member list narrowed by a role is stale the moment that role is taken
      // away or handed out. Every organization's, because this mutation knows
      // the user but not which workspaces they are in.
      queryClient.invalidateQueries({ queryKey: organizationsKeys.membersAll() });
      // Reassigning a user's roles changes their ability; if that user is the
      // caller, the nav must reflect it immediately, not on the next refocus.
      queryClient.invalidateQueries({ queryKey: usersKeys.permissions() });
      options?.onSuccess?.(...args);
    },
  });
}
