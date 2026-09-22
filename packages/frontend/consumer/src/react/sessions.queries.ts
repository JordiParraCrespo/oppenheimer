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

/** What starting a session takes: the draft, and the key that makes a retry safe. */
export interface CreateSessionVariables {
  input: CreateSessionInput;
  /**
   * The caller's `Idempotency-Key`. It belongs to the **attempt**, not to this
   * hook: a lost response leaves somebody looking at an error over a session
   * that was in fact created, and pressing send again must return that session
   * rather than build a second worktree. Only the screen holding the draft
   * knows the second press is the same attempt, so it mints the key and keeps
   * it until one succeeds.
   */
  idempotencyKey: string;
}

/** Start a session: New session's chips, its foot row and its first task. */
export function useCreateSession(
  options?: UseMutationOptions<SessionEntity, Error, CreateSessionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, idempotencyKey }: CreateSessionVariables) =>
      app.sessions.create(input, idempotencyKey),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useStopSession(options?: UseMutationOptions<SessionEntity, Error, string>) {
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
