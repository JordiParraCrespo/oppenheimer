// Cases for ../mutation-on-success.grit. See README.md.
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { withCacheOnSuccess } from '../../packages/frontend/core/src/react/mutations';

type Options = Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>;
const logout = async (_id: string) => {};

export function useSpreadLast(options?: Options) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    // biome-ignore lint/plugin/mutation-on-success: spread after, the caller's onSuccess wins
    onSuccess: () => queryClient.clear(),
    ...options,
  });
}

export function useSpreadFirst(options?: Options) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    ...options,
    // biome-ignore lint/plugin/mutation-on-success: correct today, one reorder from the bug
    onSuccess: () => queryClient.clear(),
  });
}

export function useTyped(options?: Options) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: logout,
    // biome-ignore lint/plugin/mutation-on-success: the three-type-argument form auth.queries.ts uses
    onSuccess: () => queryClient.clear(),
    ...options,
  });
}

export function useThroughTheHelper(options?: Options) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    ...withCacheOnSuccess(options, () => queryClient.clear()),
  });
}

export function useCallSite() {
  const { mutate } = useThroughTheHelper();
  return (id: string) => mutate(id, { onSuccess: () => {} });
}
