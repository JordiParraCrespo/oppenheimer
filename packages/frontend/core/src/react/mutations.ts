'use client';

import {
  type QueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

export type HookMutationOptions<TData, TError, TVariables, TOnMutateResult = unknown> = Omit<
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
 * Spread by hand, `...options` after the hook's `onSuccess` replaces it, which
 * is how logout once navigated to `/login` without clearing the cache:
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

/**
 * Refetch every cached read, because the caller now stands somewhere else.
 *
 * Only a write that changes which workspace the caller is in may do this —
 * claiming their first one (`useClaimPersonalWorkspace`) — since the shell, the
 * nav's permissions and every org-scoped list answered "who are you and
 * where". Anything else invalidates by the narrowest key; the name is here so
 * a bare `invalidateQueries()` is never copied from one of those.
 */
export function refetchEverythingForNewIdentity(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries();
}

/** What a mutation hook made by {@link defineMutation} does. */
export interface MutationSpec<TApp, TData, TVariables> {
  /** The write, against the app the hook reads. */
  run: (app: TApp, variables: TVariables) => Promise<TData>;
  /** The reads the write makes stale, refetched in the background. */
  invalidates?: (data: TData, variables: TVariables) => readonly QueryKey[];
  /**
   * The cache writes the hook makes itself, awaited before the caller's
   * `onSuccess`: return a refetch's promise to hold the mutation pending
   * until it lands.
   */
  update?: (queryClient: QueryClient, data: TData, variables: TVariables) => unknown;
}

/**
 * The mutation hooks of one product, from what each one does. `useApp` is
 * how the product reads its app (`useConsumerApp`); the kernel never imports
 * a product, so the product binds it once:
 *
 * ```ts
 * export const mutation = defineMutation(useConsumerApp);
 *
 * export const useArchiveProject = mutation({
 *   run: (app, id: string) => app.projects.archive(id),
 *   invalidates: () => [projectsKeys.lists()],
 * });
 * ```
 *
 * The hook takes the caller's options, with its own cache work in front of
 * their `onSuccess` ({@link withCacheOnSuccess}). A hook whose write also
 * needs `onMutate` or `onError` of its own writes `useMutation` out.
 */
export function defineMutation<TApp>(useApp: () => TApp) {
  return function mutation<TData, TVariables = void>(
    spec: MutationSpec<TApp, TData, TVariables>,
  ): (
    options?: HookMutationOptions<TData, Error, TVariables>,
  ) => UseMutationResult<TData, Error, TVariables> {
    return function useDefinedMutation(options) {
      const app = useApp();
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (variables: TVariables) => spec.run(app, variables),
        ...withCacheOnSuccess(options, (data, variables) => {
          for (const queryKey of spec.invalidates?.(data, variables) ?? []) {
            void queryClient.invalidateQueries({ queryKey });
          }
          return spec.update?.(queryClient, data, variables);
        }),
      });
    };
  };
}
