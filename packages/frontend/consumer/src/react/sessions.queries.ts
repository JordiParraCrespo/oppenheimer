'use client';

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { CreateSessionInput, SessionEntity } from '../modules/sessions/session.entity';
import { useConsumerApp } from './context';

/**
 * Query key factory for the `sessions` feature, from the most generic (`all`)
 * to the most specific so a whole subtree can be invalidated with one key.
 */
export const sessionsKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: () => [...sessionsKeys.lists()] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionsKeys.details(), id] as const,
};

/** The sessions in the caller's workspace: the sidebar and the sessions list. */
export function useSessions(
  options?: Omit<UseQueryOptions<SessionEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: sessionsKeys.list(),
    queryFn: () => app.sessions.findAll(),
    ...options,
  });
}

export function useSession(
  id: string,
  options?: Omit<UseQueryOptions<SessionEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: sessionsKeys.detail(id),
    queryFn: () => app.sessions.findById(id),
    enabled: Boolean(id),
    ...options,
  });
}

/** Start a session: New session's four chips and a name. */
export function useCreateSession(
  options?: UseMutationOptions<SessionEntity, Error, CreateSessionInput>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSessionInput) => app.sessions.create(input),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useStopSession(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.sessions.stop(id),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      options?.onSuccess?.(...args);
    },
  });
}
