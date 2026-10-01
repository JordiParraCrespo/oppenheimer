'use client';

import { shareEntities, useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type QueryClient,
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  CreateSessionInput,
  SessionAttachment,
  SessionEntity,
} from '../modules/sessions/session.entity';
import type { SessionStartProgress } from '../modules/sessions/session-steps';
import { useConsumerApp } from './context';
import { CLOSE_WATCH_MS, type PollKeys, pollWhile, RESTART_WATCH_MS } from './live-poll';

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
 * The sessions a console asked to close and has not yet seen resolve, each
 * with the timer that ends its watch — per `QueryClient`, so the watch lives
 * and dies with the cache it keeps polling, and two clients never share one.
 *
 * A close is answered by the host, not by the request, so the row stays `open`
 * for a beat after Delete — "not settled, and nothing pushes it", like a
 * starting session, and the list polls for it on `LIVE_POLL.sessionStarting`.
 * An id leaves when its row leaves the list, or after {@link CLOSE_WATCH_MS}.
 */
const closeWatches = new WeakMap<QueryClient, Map<string, ReturnType<typeof setTimeout>>>();

function closesOf(queryClient: QueryClient): Map<string, ReturnType<typeof setTimeout>> {
  let watches = closeWatches.get(queryClient);
  if (!watches) {
    watches = new Map();
    closeWatches.set(queryClient, watches);
  }
  return watches;
}

/** Watch a close; asking again restarts the watch rather than adding a second. */
function watchClose(queryClient: QueryClient, id: string): void {
  const watches = closesOf(queryClient);
  clearTimeout(watches.get(id));
  watches.set(
    id,
    setTimeout(() => watches.delete(id), CLOSE_WATCH_MS),
  );
}

function unwatchClose(queryClient: QueryClient, id: string): void {
  const watches = closesOf(queryClient);
  clearTimeout(watches.get(id));
  watches.delete(id);
}

/**
 * Sessions whose restart this console asked for and whose host has not
 * answered yet. The same shape as the close watch above, and for the same
 * reason: the row does not move until the host moves it.
 */
const restartWatches = new WeakMap<QueryClient, Map<string, ReturnType<typeof setTimeout>>>();

function restartsOf(queryClient: QueryClient): Map<string, ReturnType<typeof setTimeout>> {
  let watches = restartWatches.get(queryClient);
  if (!watches) {
    watches = new Map();
    restartWatches.set(queryClient, watches);
  }
  return watches;
}

function watchRestart(queryClient: QueryClient, id: string): void {
  const watches = restartsOf(queryClient);
  clearTimeout(watches.get(id));
  watches.set(
    id,
    setTimeout(() => watches.delete(id), RESTART_WATCH_MS),
  );
}

function unwatchRestart(queryClient: QueryClient, id: string): void {
  const watches = restartsOf(queryClient);
  clearTimeout(watches.get(id));
  watches.delete(id);
}

/**
 * The sessions in the caller's workspace: the sidebar and the sessions list.
 *
 * A resolved session is a tombstone the API keeps so its directory and branch
 * are never reissued; the list leaves it out, though its detail is still
 * written for a screen that has it open. It polls while a row is starting or a
 * close this console asked for has not resolved.
 *
 * Each row is also written to that session's detail, so opening a session from
 * the list renders on the click; a detail read after this list was asked for
 * is as new or newer, and is left alone.
 *
 * Pass `select` to subscribe to less than the whole list, so a screen that only
 * asks whether any exist does not re-render on every poll.
 */
export function useSessions<TData = SessionEntity[]>(
  options?: Omit<UseQueryOptions<SessionEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useQuery<SessionEntity[], Error, TData>({
    queryKey: sessionsKeys.list(),
    queryFn: async () => {
      const askedAt = Date.now();
      const sessions = await app.sessions.findAll();
      for (const session of sessions) {
        const key = sessionsKeys.detail(session.id);
        if ((queryClient.getQueryState(key)?.dataUpdatedAt ?? 0) >= askedAt) continue;
        // Shared against what the detail already holds, so a poll that
        // changed nothing leaves the open session's screen alone.
        queryClient.setQueryData<SessionEntity>(key, (current) => shareEntities(current, session));
      }
      const listed = sessions.filter((session) => !session.isResolved);
      for (const id of closesOf(queryClient).keys()) {
        if (!listed.some((session) => session.id === id)) unwatchClose(queryClient, id);
      }
      return listed;
    },
    ...options,
    // Over the query's own rows, before any caller's `select`.
    ...pollWhile<SessionEntity[]>(
      'sessionStarting',
      (rows) =>
        rows?.some((session) => session.isProvisioning || closesOf(queryClient).has(session.id)) ??
        false,
    ),
  });
}

export function useSession(
  id: string | undefined,
  options?: Omit<UseQueryOptions<SessionEntity, Error>, 'queryKey' | 'queryFn' | PollKeys>,
) {
  const app = useConsumerApp();

  const queryClient = useQueryClient();

  return useQuery({
    queryKey: sessionsKeys.detail(id),
    queryFn: id
      ? async () => {
          const session = await app.sessions.findById(id);
          // The host answered: the terminal is back, so stop watching.
          if (session.isLive) unwatchRestart(queryClient, id);
          return session;
        }
      : skipToken,
    ...options,
    ...pollWhile<SessionEntity>(
      'sessionOpening',
      (session) =>
        (session?.isProvisioning ?? false) || (id ? restartsOf(queryClient).has(id) : false),
    ),
  });
}

/**
 * Refetch one session now. Its detail query has no polling of its own once it
 * is live, so a screen that learns the row changed under it — a terminal
 * whose stream ended — asks here rather than reaching into the query cache.
 */
export function useInvalidateSession(id: string): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(id) });
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
  options?: Omit<UseQueryOptions<SessionStartProgress, Error>, 'queryKey' | 'queryFn' | PollKeys>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: sessionsKeys.start(id, failed),
    queryFn:
      id && (starting || failed) ? () => app.sessions.startProgress(id, { failed }) : skipToken,
    ...options,
    ...pollWhile<SessionStartProgress>('sessionOpening', (progress) => !progress?.settled),
  });
}

export interface CreateSessionVariables {
  input: CreateSessionInput;
  /**
   * The caller's `Idempotency-Key`. It belongs to the **attempt**, not to this
   * hook: only the screen holding the draft knows that a second press after a
   * lost response is the same attempt, so it mints the key and keeps it until
   * one succeeds.
   */
  idempotencyKey: string;
}

export function useCreateSession(
  options?: UseMutationOptions<SessionEntity, Error, CreateSessionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, idempotencyKey }: CreateSessionVariables) =>
      app.sessions.create(input, idempotencyKey),
    ...withCacheOnSuccess(options, (session) => {
      // The row the API just answered with, put where the session screen reads
      // it. Without this the screen the caller navigates to opens `pending`,
      // draws its skeleton and fetches the session it was handed a moment ago:
      // a round trip on the critical path between pressing send and the
      // terminal mounting, which is the one stretch a reader is watching. Every
      // other session mutation already seeds it ({@link useSessionPatch});
      // create was the one that did not.
      queryClient.setQueryData(sessionsKeys.detail(session.id), session);
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    }),
  });
}

export interface RenameSessionVariables {
  id: string;
  name: string;
}

export interface MoveSessionVariables {
  id: string;
  projectId: string;
}

/**
 * A write to one session's row that the API answers with the row: the detail
 * takes the answer and the list is re-read.
 */
function useSessionPatch<TVariables>(
  patch: (app: ReturnType<typeof useConsumerApp>, variables: TVariables) => Promise<SessionEntity>,
  options?: UseMutationOptions<SessionEntity, Error, TVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TVariables) => patch(app, variables),
    ...withCacheOnSuccess(options, (session) => {
      queryClient.setQueryData(sessionsKeys.detail(session.id), session);
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    }),
  });
}

export function useRenameSession(
  options?: UseMutationOptions<SessionEntity, Error, RenameSessionVariables>,
) {
  return useSessionPatch(({ sessions }, { id, name }) => sessions.rename(id, name), options);
}

export function useMoveSession(
  options?: UseMutationOptions<SessionEntity, Error, MoveSessionVariables>,
) {
  return useSessionPatch(
    ({ sessions }, { id, projectId }) => sessions.move(id, projectId),
    options,
  );
}

export interface CloseSessionVariables {
  id: string;
  acceptUnpushedWork?: boolean;
}

/** The row stays `open` until the host resolves it, so the list watches for that. */
/**
 * Bring a stopped session's terminal back.
 *
 * The host recreates window 0 in the worktrees the session already has and
 * reopens the agent's own conversation, so the pane comes back with what was
 * said in it rather than empty. The session's own row is refreshed and the
 * lists with it: what changes is the lifecycle, which every list draws.
 */
export function useRestartSession(options?: UseMutationOptions<SessionEntity, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.sessions.restart(id),
    ...withCacheOnSuccess(options, (session) => {
      queryClient.setQueryData(sessionsKeys.detail(session.id), session);
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      // A restart is a request; the row is still stopped until the host says
      // otherwise, so the detail reads until it does.
      watchRestart(queryClient, session.id);
    }),
  });
}

export function useCloseSession(
  options?: UseMutationOptions<SessionEntity, Error, CloseSessionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, acceptUnpushedWork }: CloseSessionVariables) =>
      app.sessions.close(id, acceptUnpushedWork),
    ...withCacheOnSuccess(options, (session) => {
      watchClose(queryClient, session.id);
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    }),
  });
}

/**
 * Upload an image for New session's first task. Nothing is cached: what comes
 * back is the id the create names in `attachmentIds`.
 */
export function useUploadSessionAttachment(
  options?: UseMutationOptions<SessionAttachment, Error, Blob>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: (image: Blob) => app.sessions.uploadAttachment(image),
    ...options,
  });
}

/**
 * Paste an image into one window's prompt. Nothing is cached and no key is
 * kept: success is the path appearing in the terminal, which the terminal
 * itself shows.
 */
export function usePasteSessionImage(
  sessionId: string,
  window = 0,
  options?: UseMutationOptions<void, Error, Blob>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: (image: Blob) => app.sessions.pasteImage(sessionId, image, window),
    ...options,
  });
}
