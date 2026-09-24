'use client';

import { usersKeys, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type { ChangeOwnPasswordDto, UpdateProfileDto } from '@oppenheimer/shared/schemas/profile';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { ProfileEntity, UserSessionEntity } from '../modules/profile/profile.entity';
import { useConsumerApp } from './context';

/**
 * Query keys for the signed-in user's own account.
 *
 * No id anywhere: every endpoint under `/profile` acts on whoever the
 * credential belongs to. Signing in as somebody else has to clear this subtree
 * rather than fetch a different key — `reconcileCacheOwner` already does that
 * for the whole cache.
 */
export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
  sessions: () => [...profileKeys.all, 'sessions'] as const,
};

export function useMyProfile(
  options?: Omit<UseQueryOptions<ProfileEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => app.profile.get(),
    ...options,
  });
}

/**
 * Seeds the cache with the response rather than invalidating it: every write
 * under `/profile` answers with the whole document, so the screen can show the
 * saved state without a second round trip, and the value it shows is the
 * server's, not an optimistic guess.
 *
 * `usersKeys.me()` is invalidated alongside it because the shell reads the
 * user's name from the directory's "me" query — leaving it alone would rename
 * the profile card and not the sidebar.
 */
function useProfileWrite<TVariables>(
  mutationFn: (variables: TVariables) => Promise<ProfileEntity>,
  options?: UseMutationOptions<ProfileEntity, Error, TVariables>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    ...withCacheOnSuccess(options, (profile) => {
      queryClient.setQueryData(profileKeys.me(), profile);
      queryClient.invalidateQueries({ queryKey: usersKeys.me() });
    }),
  });
}

export function useUpdateMyProfile(
  options?: UseMutationOptions<ProfileEntity, Error, UpdateProfileDto>,
) {
  const app = useConsumerApp();

  return useProfileWrite((dto: UpdateProfileDto) => app.profile.update(dto), options);
}

export function useUploadAvatar(options?: UseMutationOptions<ProfileEntity, Error, Blob>) {
  const app = useConsumerApp();

  return useProfileWrite((file: Blob) => app.profile.uploadAvatar(file), options);
}

export function useDeleteAvatar(options?: UseMutationOptions<ProfileEntity, Error, void>) {
  const app = useConsumerApp();

  return useProfileWrite(() => app.profile.deleteAvatar(), options);
}

/**
 * Changing your own password.
 *
 * Named apart from `useChangePassword` in `auth.queries`, which goes through
 * Better Auth's client. This one is the REST endpoint, and it defaults to
 * revoking the other sessions — so the session list is invalidated on success.
 */
export function useChangeOwnPassword(
  options?: UseMutationOptions<void, Error, ChangeOwnPasswordDto>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ChangeOwnPasswordDto) => app.profile.changePassword(dto),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
    }),
  });
}

export function useProfileSessions(
  options?: Omit<UseQueryOptions<UserSessionEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: profileKeys.sessions(),
    queryFn: () => app.profile.getSessions(),
    ...options,
  });
}

export function useRevokeProfileSession(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => app.profile.revokeSession(sessionId),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
    }),
  });
}

export function useRevokeOtherProfileSessions(options?: UseMutationOptions<void, Error, void>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => app.profile.revokeOtherSessions(),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
    }),
  });
}
