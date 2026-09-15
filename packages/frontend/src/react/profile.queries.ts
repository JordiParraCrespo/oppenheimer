'use client';

import type {
  ChangeOwnPasswordDto,
  UpdateProfileDto,
  UpdateUserSettingsDto,
} from '@oppenheimer/shared/schemas/profile';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  ProfileEntity,
  UserSessionEntity,
  UserSettingsEntity,
} from '../modules/profile/profile.entity';
import { useOppenheimerApp } from './context';
import { usersKeys } from './users.queries';

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
  settings: () => [...profileKeys.all, 'settings'] as const,
  sessions: () => [...profileKeys.all, 'sessions'] as const,
};

export function useMyProfile(
  options?: Omit<UseQueryOptions<ProfileEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

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
    ...options,
    onSuccess: (...args) => {
      const [profile] = args;
      queryClient.setQueryData(profileKeys.me(), profile);
      queryClient.invalidateQueries({ queryKey: usersKeys.me() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useUpdateMyProfile(
  options?: UseMutationOptions<ProfileEntity, Error, UpdateProfileDto>,
) {
  const app = useOppenheimerApp();

  return useProfileWrite((dto: UpdateProfileDto) => app.profile.update(dto), options);
}

export function useUploadAvatar(options?: UseMutationOptions<ProfileEntity, Error, Blob>) {
  const app = useOppenheimerApp();

  return useProfileWrite((file: Blob) => app.profile.uploadAvatar(file), options);
}

export function useDeleteAvatar(options?: UseMutationOptions<ProfileEntity, Error, void>) {
  const app = useOppenheimerApp();

  return useProfileWrite(() => app.profile.deleteAvatar(), options);
}

export function useUserSettings(
  options?: Omit<UseQueryOptions<UserSettingsEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: profileKeys.settings(),
    queryFn: () => app.profile.getSettings(),
    ...options,
  });
}

export function useUpdateUserSettings(
  options?: UseMutationOptions<UserSettingsEntity, Error, UpdateUserSettingsDto>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateUserSettingsDto) => app.profile.updateSettings(dto),
    ...options,
    onSuccess: (...args) => {
      const [settings] = args;
      queryClient.setQueryData(profileKeys.settings(), settings);
      options?.onSuccess?.(...args);
    },
  });
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
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ChangeOwnPasswordDto) => app.profile.changePassword(dto),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useProfileSessions(
  options?: Omit<UseQueryOptions<UserSessionEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: profileKeys.sessions(),
    queryFn: () => app.profile.getSessions(),
    ...options,
  });
}

export function useRevokeProfileSession(options?: UseMutationOptions<void, Error, string>) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => app.profile.revokeSession(sessionId),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useRevokeOtherProfileSessions(options?: UseMutationOptions<void, Error, void>) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => app.profile.revokeOtherSessions(),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
      options?.onSuccess?.(...args);
    },
  });
}
