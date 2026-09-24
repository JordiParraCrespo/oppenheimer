'use client';

import type { UseMutationOptions } from '@tanstack/react-query';

type HookMutationOptions<TData, TError, TVariables, TOnMutateResult> = Omit<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  'mutationFn'
>;

type OnSuccessArgs<TData, TError, TVariables, TOnMutateResult> = Parameters<
  NonNullable<HookMutationOptions<TData, TError, TVariables, TOnMutateResult>['onSuccess']>
>;

/**
 * A mutation hook's `options` with the hook's own cache update in front of the
 * caller's `onSuccess`.
 *
 * Every mutation hook takes `options` and has a cache write of its own to make.
 * Spread by hand, the order decides whether that write happens: `...options`
 * after the hook's `onSuccess` replaces it, which is how logout once navigated
 * to `/login` without clearing the cache. Going through this makes the order a
 * function's, not each hook's:
 *
 * ```ts
 * return useMutation({
 *   mutationFn: () => app.auth.logout(),
 *   ...withCacheOnSuccess(options, () => queryClient.clear()),
 * });
 * ```
 *
 * `update` runs first and is awaited, so a hook that returns its invalidation's
 * promise holds the mutation pending until the refetch lands. The caller's
 * `onSuccess` runs after it, with the same arguments.
 */
export function withCacheOnSuccess<TData, TError, TVariables, TOnMutateResult = unknown>(
  options: HookMutationOptions<TData, TError, TVariables, TOnMutateResult> | undefined,
  update: (...args: OnSuccessArgs<TData, TError, TVariables, TOnMutateResult>) => unknown,
): HookMutationOptions<TData, TError, TVariables, TOnMutateResult> {
  return {
    ...options,
    onSuccess: async (...args) => {
      await update(...args);
      return options?.onSuccess?.(...args);
    },
  };
}
