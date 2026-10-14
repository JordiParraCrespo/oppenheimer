'use client';

import type { PermissionDefinition } from '@oppenheimer/shared';
import { type UseQueryOptions } from '@tanstack/react-query';
import type { UserEntity } from '../modules/users/user.entity';
import { useOppenheimerApp } from './context';
import { PERSIST_META } from './persist-meta';
import { useQuery } from './query';

/**
 * Each level is derived from the one above (`apps/docs/docs/architecture/query-keys.md`).
 * `permissions` sits under `me` on purpose: whatever changes who the caller is
 * invalidates `me()`, and their permissions refetch with it.
 */
export const usersKeys = {
  all: ['users'] as const,
  me: () => [...usersKeys.all, 'me'] as const,
  permissions: () => [...usersKeys.me(), 'permissions'] as const,
};

/**
 * Kept alongside the profile query so the shell can build the signed-in
 * user's ability once and share it. The one `users` read that persists: it
 * names actions and subjects, not the person, and the nav reads it on a warm
 * start before the refetch lands.
 */
export function useMyPermissions(
  options?: Omit<UseQueryOptions<PermissionDefinition[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: usersKeys.permissions(),
    queryFn: () => app.users.myPermissions(),
    meta: PERSIST_META,
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
