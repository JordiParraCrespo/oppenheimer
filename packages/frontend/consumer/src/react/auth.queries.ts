'use client';

import { profileQueryKey } from '@oppenheimer/frontend-core/react';
import type { RegisterDto } from '@oppenheimer/shared';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConsumerApp } from './context';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
    ...options,
  });
}
