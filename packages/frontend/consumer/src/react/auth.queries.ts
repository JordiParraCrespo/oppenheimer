'use client';

import { usersKeys, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type { RegisterDto } from '@oppenheimer/shared';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConsumerApp } from './context';
import { profileKeys } from './profile.queries';

/**
 * Sign-up is the consumer product's: an account is created here and nowhere
 * else, which is why the hook lives in this package while `useLogin` and the
 * session live in the kernel. The service method stays on the kernel's
 * `AuthService` because it shares the identity tracking every sign-in uses.
 */
export function useRegister(
  options?: Omit<UseMutationOptions<void, Error, RegisterDto>, 'mutationFn'>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation<void, Error, RegisterDto>({
    mutationFn: (dto: RegisterDto) => app.auth.register(dto),
    // Both views of the caller: the directory's, which the shell reads, and the
    // account's own, which Settings reads.
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.me() });
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    }),
  });
}
