'use client';

import type { AdminCreateUserRequest, AdminUpdateUserRequest } from '@oppenheimer/api-client';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AdminSessionEntity,
  AdminUserEntity,
  AdminUsersListParams,
} from '../modules/admin-users';
import { useOppenheimerApp } from './context';
import { rolesKeys } from './roles.queries';
import { usersKeys } from './users.queries';

export const adminUsersKeys = {
  all: ['admin-users'] as const,
  lists: () => [...adminUsersKeys.all, 'list'] as const,
  list: (params?: AdminUsersListParams) => [...adminUsersKeys.lists(), params ?? {}] as const,
  details: () => [...adminUsersKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminUsersKeys.details(), id] as const,
  sessions: (id: string) => [...adminUsersKeys.detail(id), 'sessions'] as const,
};

export function useAdminUsers(
  params?: AdminUsersListParams,
  options?: Omit<
    UseQueryOptions<{
      data: AdminUserEntity[];
      total: number;
      limit: number | null;
      offset: number | null;
    }>,
    'queryKey' | 'queryFn'
  >,
) {
  const app = useOppenheimerApp();
  return useQuery({
    queryKey: adminUsersKeys.list(params),
    queryFn: () => app.adminUsers.findAll(params),
    ...options,
  });
}

export function useAdminUser(
  id: string,
  options?: Omit<UseQueryOptions<AdminUserEntity>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();
  return useQuery({
    queryKey: adminUsersKeys.detail(id),
    queryFn: () => app.adminUsers.findById(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useAdminUserSessions(
  id: string,
  options?: Omit<UseQueryOptions<AdminSessionEntity[]>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();
  return useQuery({
    queryKey: adminUsersKeys.sessions(id),
    queryFn: () => app.adminUsers.sessions(id),
    enabled: Boolean(id),
    ...options,
  });
}

function useAdminUserMutation<TVariables>(
  mutationFn: (
    app: ReturnType<typeof useOppenheimerApp>,
    variables: TVariables,
  ) => Promise<unknown>,
  options?: UseMutationOptions<unknown, Error, TVariables>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => mutationFn(app, variables),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.all });
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      options?.onSuccess?.(...args);
    },
  });
}

export function useCreateAdminUser(
  options?: UseMutationOptions<unknown, Error, AdminCreateUserRequest>,
) {
  return useAdminUserMutation((app, dto) => app.adminUsers.create(dto), options);
}

export function useUpdateAdminUser(
  options?: UseMutationOptions<unknown, Error, { id: string; dto: AdminUpdateUserRequest }>,
) {
  return useAdminUserMutation((app, { id, dto }) => app.adminUsers.update(id, dto), options);
}

export function useSetPlatformRole(
  options?: UseMutationOptions<unknown, Error, { id: string; role: string | string[] }>,
) {
  return useAdminUserMutation(
    (app, { id, role }) => app.adminUsers.setPlatformRole(id, role),
    options,
  );
}

export function useBanAdminUser(
  options?: UseMutationOptions<unknown, Error, { id: string; reason?: string }>,
) {
  return useAdminUserMutation((app, { id, reason }) => app.adminUsers.ban(id, reason), options);
}

export function useUnbanAdminUser(options?: UseMutationOptions<unknown, Error, string>) {
  return useAdminUserMutation((app, id) => app.adminUsers.unban(id), options);
}

export function useDeleteAdminUser(options?: UseMutationOptions<unknown, Error, string>) {
  return useAdminUserMutation((app, id) => app.adminUsers.remove(id), options);
}

export function useSetAdminUserPassword(
  options?: UseMutationOptions<unknown, Error, { id: string; newPassword: string }>,
) {
  return useAdminUserMutation(
    (app, { id, newPassword }) => app.adminUsers.setPassword(id, newPassword),
    options,
  );
}

export function useRevokeAdminUserSessions(options?: UseMutationOptions<unknown, Error, string>) {
  return useAdminUserMutation(async (app, id) => {
    await app.adminUsers.revokeAllSessions(id);
  }, options);
}
export function useAssignAdminUserRoles(
  options?: UseMutationOptions<unknown, Error, { userId: string; roleIds: string[] }>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleIds }) => app.roles.assignToUser(userId, roleIds),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.all });
      options?.onSuccess?.(...args);
    },
  });
}
