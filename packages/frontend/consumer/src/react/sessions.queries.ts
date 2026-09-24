'use client';

import { withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { CreateSessionInput, SessionEntity } from '../modules/sessions/session.entity';
import type { SessionStartProgress } from '../modules/sessions/session-steps';
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
  detail: (id: string | undefined) => [...sessionsKeys.details(), id] as const,
  start: (id: string | undefined, failed: boolean) =>
    [...sessionsKeys.detail(id), 'start', { failed }] as const,
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
  id: string | undefined,
  options?: Omit<UseQueryOptions<SessionEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: sessionsKeys.detail(id),
    queryFn: id ? () => app.sessions.findById(id) : skipToken,
    refetchInterval: (query) => (query.state.data?.isProvisioning ? PROVISIONING_POLL_MS : false),
    ...options,
  });
}

/**
 * How a session's start is going: the steps the host reported, and its reason
 * when the start failed.
 *
 * It reads while the session is starting, at the row's own pace, and stops the
 * moment the log says how the start ended. A failed row keeps reading until the
 * log carries the host's reason, which can land a read after the row turned
 * `failed`. A live or finished session never reads it at all.
 */
export function useSessionStartProgress(
  id: string | undefined,
  { starting, failed }: { starting: boolean; failed: boolean },
  options?: Omit<UseQueryOptions<SessionStartProgress, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: sessionsKeys.start(id, failed),
    queryFn:
      id && (starting || failed) ? () => app.sessions.startProgress(id, { failed }) : skipToken,
    refetchInterval: (query) => (query.state.data?.settled ? false : PROVISIONING_POLL_MS),
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
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    }),
  });
}

export function useStopSession(options?: UseMutationOptions<SessionEntity, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.sessions.stop(id),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
    }),
  });
}
