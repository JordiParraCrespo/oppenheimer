'use client';

import type { PermissionDefinition } from '@oppenheimer/shared';
import { type UseQueryOptions } from '@tanstack/react-query';
import type { UserEntity } from '../modules/users/user.entity';
import { useOppenheimerApp } from './context';
import { useQuery } from './query';

/**
 * Query key factory for the `users` feature: the signed-in user and their
 * permissions, each level derived from the one above. See the "React Query
 * keys" guide in the docs for the rationale.
 */
export const usersKeys = {
  all: ['users'] as const,
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
