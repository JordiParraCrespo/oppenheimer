'use client';

import type { LoginDto } from '@oppenheimer/shared';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { CORE_CONFIG } from '../config';
import type { SocialAuthIntent, SocialProvider } from '../modules/auth/auth.client';
import { useOppenheimerApp } from './context';
import { featureFlagsQueryOptions } from './feature-flags.queries';
import { withCacheOnSuccess } from './mutations';
import { reconcileCacheOwner } from './persistence';
import { useQuery } from './query';
import { expireSession } from './query-client';
import { authKeys } from './query-keys';
import { usersKeys } from './users.queries';

export { authKeys };

export function useSessionRestore(
  options?: Omit<UseQueryOptions<string | null, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: authKeys.session(),
    queryFn: async () => {
      const userId = await app.auth.restoreSession();
      reconcileCacheOwner(queryClient, userId);

      // Start the flags request now that we know who is asking, so it runs
      // beside the first route's code rather than after the first screen has
      // rendered its defaults. Not awaited: flags never hold up the gate, and
      // a fresh persisted copy makes this a no-op.
      void queryClient.prefetchQuery(
        featureFlagsQueryOptions(app, userId ? 'signed-in' : 'anonymous'),
      );

      return userId;
    },
    // `restoreSession()` only rejects when the session lookup itself fails
    // (network/server error); a signed-out user resolves, so retries never
    // fire for them.
    retry: CORE_CONFIG.session.restoreRetries,
    retryDelay: (attempt) =>
      Math.min(
        CORE_CONFIG.session.restoreRetryBaseMs * 2 ** attempt,
        CORE_CONFIG.session.restoreRetryMaxMs,
      ),
    staleTime: Infinity,
    ...options,
  });
}

/**
 * What a social button hands the mutation. The `intent` is what separates the
 * login screen's button from the register screen's ({@link SocialAuthIntent}).
 */
export interface SocialLoginVariables {
  provider: SocialProvider;
  /** Defaults to `'sign-in'`. */
  intent?: SocialAuthIntent;
}

export function useSocialLogin(
  options?: Omit<UseMutationOptions<void, Error, SocialLoginVariables>, 'mutationFn'>,
) {
  const app = useOppenheimerApp();

  return useMutation<void, Error, SocialLoginVariables>({
    mutationFn: ({ provider, intent }) => app.auth.socialLogin(provider, intent),
    ...options,
  });
}

export function useLogin(options?: Omit<UseMutationOptions<void, Error, LoginDto>, 'mutationFn'>) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: LoginDto) => app.auth.login(dto),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.me() });
    }),
  });
}

export function useLogout(options?: Omit<UseMutationOptions<void, Error, void>, 'mutationFn'>) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => app.auth.logout(),
    ...withCacheOnSuccess(options, () => {
      queryClient.clear();
    }),
  });
}

/**
 * End a session the server has stopped honouring, from something that is not a
 * query: a terminal's stream closing as `unauthorized`, say. The query client
 * does the same for every 401 it sees; this is that path for the rest.
 */
export function useExpireSession(): () => void {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();
  return () => expireSession(app, queryClient);
}

export function useForgotPassword(
  options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>,
) {
  const app = useOppenheimerApp();

  return useMutation({
    mutationFn: (email: string) => app.auth.forgotPassword(email),
    ...options,
  });
}

export function useResetPassword(
  options?: Omit<
    UseMutationOptions<void, Error, { token: string; password: string }>,
    'mutationFn'
  >,
) {
  const app = useOppenheimerApp();

  return useMutation({
    mutationFn: ({ token, password }) => app.auth.resetPassword(token, password),
    ...options,
  });
}
