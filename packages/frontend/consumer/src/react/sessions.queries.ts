'use client';

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { CreateSessionInput, SessionEntity } from '../modules/sessions/session.entity';
import { isSessionStartSettled, type SessionEvent } from '../modules/sessions/session-steps';
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
  events: (id: string) => [...sessionsKeys.detail(id), 'events'] as const,
};

/**
 * How often a session that is still starting is asked about again.
 *
 * Nothing pushes a session's lifecycle to the console yet: the host builds the
 * worktree and opens the PTY, the control plane flips the row to `open`, and a
 * screen that read it as `starting` would sit on the provisioning pane until a
 * reload. So a query holding a starting session polls until it holds none — a
 * clone from GitHub takes seconds, and polling past that would be a request
 * every two seconds that can only answer "still open". When session events are
 * streamed to the console this goes.
 */
const PROVISIONING_POLL_MS = 2000;

/** The sessions in the caller's workspace: the sidebar and the sessions list. */
export function useSessions(
  options?: Omit<UseQueryOptions<SessionEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: sessionsKeys.list(),
    queryFn: () => app.sessions.findAll(),
    refetchInterval: (query) =>
      query.state.data?.some((session) => session.isProvisioning) ? PROVISIONING_POLL_MS : false,
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
    refetchInterval: (query) => (query.state.data?.isProvisioning ? PROVISIONING_POLL_MS : false),
    ...options,
  });
}

/**
 * A session's log, which is what its provisioning steps are drawn from.
 *
 * It polls until the log says how the start ended (`session.started` or
 * `session.failed`) and then stops: a live or finished session never reads its
 * log in a loop, and a failed one still gets the entry carrying the host's
 * reason, which can land a read after the row turned `failed`.
 */
export function useSessionEvents(
  id: string,
  options?: Omit<UseQueryOptions<SessionEvent[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: sessionsKeys.events(id),
    queryFn: () => app.sessions.findEvents(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      isSessionStartSettled(query.state.data) ? false : PROVISIONING_POLL_MS,
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
