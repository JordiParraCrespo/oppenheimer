'use client';

import {
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
  withCacheOnSuccess,
} from '@oppenheimer/frontend-core/react';
import type { PutSessionShareDto } from '@oppenheimer/shared/schemas/session-share';
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
  PrepareSessionInput,
  SessionAttachment,
  SessionEntity,
  SessionShare,
  SharedSession,
} from '../modules/sessions/session.entity';
import {
  deriveSessionStartProgress,
  type SessionStartProgress,
} from '../modules/sessions/session-steps';
import { useConsumerApp } from './context';
import { useHostListQuery } from './hosts.queries';
import { CLOSE_WATCH_MS, type PollKeys, RESTART_WATCH_MS, usePollWhile } from './live-poll';
import { useProjectListQuery } from './projects.queries';
import { seedDetails } from './seed-details';

/**
 * A session's share sits beside `details()`, not under `detail(id)`: sharing
 * raises no `session.changed`, so a row's every change would refetch it for
 * nothing.
 */
export const sessionsKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: () => [...sessionsKeys.lists()] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string | undefined) => [...sessionsKeys.details(), id] as const,
  start: (id: string | undefined, failed: boolean) =>
    [...sessionsKeys.detail(id), 'start', { failed }] as const,
  share: (id: string) => [...sessionsKeys.all, 'share', id] as const,
  shared: (slug: string | undefined) => [...sessionsKeys.all, 'shared', slug] as const,
};

/**
 * The sessions a console asked to close and has not yet seen resolve, each
 * with the timer that ends its watch — per `QueryClient`, so the watch lives
 * and dies with the cache it keeps polling, and two clients never share one.
 *
 * A close is answered by the host, not by the request, so the row stays `open`
 * for a beat after Delete. The list leaves a watched row out from the click
 * (the reader asked for it gone, and the host refuses rarely) and polls on
 * `LIVE_POLL.sessionStarting` until the host resolves it. An id leaves when its
 * row resolves, or after {@link CLOSE_WATCH_MS}: then the list is read again,
 * so a close the host refused brings its row back rather than hiding it for good.
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
    setTimeout(() => {
      watches.delete(id);
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    }, CLOSE_WATCH_MS),
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
  return useQuery<SessionEntity[], Error, TData>({
    ...useSessionListQuery(),
    ...options,
    ...useSessionListPoll(),
  });
}

/**
 * The sidebar's three reads under a Suspense `QueryState`: the sessions, the
 * projects they are grouped under and the hosts a facet names. They fetch side
 * by side and the sidebar suspends until all three have answered; `error` is
 * the first refetch that failed over data already drawn.
 */
export function useSuspenseSessionsSidebar() {
  const [sessions, projects, hosts] = useSuspenseQueries({
    queries: [
      { ...useSessionListQuery(), ...useSessionListPoll() },
      useProjectListQuery(),
      useHostListQuery(),
    ],
  });
  return {
    sessions: sessions.data,
    projects: projects.data,
    hosts: hosts.data,
    error: sessions.error ?? projects.error ?? hosts.error,
  };
}

/** The sessions read, for both hooks over it: the key, and a fetch that fills each detail. */
export function useSessionListQuery() {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return {
    queryKey: sessionsKeys.list(),
    queryFn: async () => {
      const askedAt = Date.now();
      const sessions = await app.sessions.findAll();
      seedDetails(queryClient, sessions, sessionsKeys.detail, askedAt);
      const unresolved = sessions.filter((session) => !session.isResolved);
      const closing = closesOf(queryClient);
      for (const id of closing.keys()) {
        if (!unresolved.some((session) => session.id === id)) unwatchClose(queryClient, id);
      }
      return unresolved.filter((session) => !closing.has(session.id));
    },
  };
}

/**
 * Over the query's own rows, before any caller's `select`. Stands down while
 * the workspace event stream carries every change to these rows.
 */
export function useSessionListPoll() {
  const queryClient = useQueryClient();
  return usePollWhile<SessionEntity[]>(
    'sessionStarting',
    sessionsKeys.list(),
    (rows) =>
      closesOf(queryClient).size > 0 || (rows?.some((session) => session.isProvisioning) ?? false),
  );
}

/**
 * One session under a Suspense `QueryState`, polling while it is being
 * prepared or a restart is watched; `data` is always the session. A 404 is
 * the boundary's first failure, which the screen says as "not found".
 */
export function useSuspenseSession(id: string) {
  return useSuspenseQuery<SessionEntity, Error>({
    ...useSessionDetailQuery(id),
    ...useSessionPoll(id),
  });
}

/**
 * The share dialog's three reads under a Suspense `QueryState`: the session
 * (its name and host), its share, and the hosts its host is named from,
 * fetched side by side. `error` is the first refetch that failed over data
 * already drawn.
 */
export function useSuspenseSessionShare(sessionId: string) {
  const [session, share, hosts] = useSuspenseQueries({
    queries: [
      { ...useSessionDetailQuery(sessionId), ...useSessionPoll(sessionId) },
      useSessionShareQuery(sessionId),
      useHostListQuery(),
    ],
  });
  return {
    session: session.data,
    share: share.data,
    hosts: hosts.data,
    error: session.error ?? share.error ?? hosts.error,
  };
}

/** One session's read, for the Suspense hooks over it: the key and the fetch, once. */
function useSessionDetailQuery(id: string) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return {
    queryKey: sessionsKeys.detail(id),
    queryFn: () => findSession(app, queryClient, id),
  };
}

async function findSession(
  app: ReturnType<typeof useConsumerApp>,
  queryClient: QueryClient,
  id: string,
) {
  const session = await app.sessions.findById(id);
  // The host answered: the terminal is back, or the session is gone from its
  // host and was closed instead. Either way, stop watching.
  if (session.isLive || session.isResolved) unwatchRestart(queryClient, id);
  return session;
}

/** A session polls while it is being prepared, or while a restart is being watched. */
function useSessionPoll(id: string) {
  const queryClient = useQueryClient();
  return usePollWhile<SessionEntity>(
    'sessionOpening',
    sessionsKeys.detail(id),
    (session) => (session?.isProvisioning ?? false) || restartsOf(queryClient).has(id),
  );
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
    ...usePollWhile<SessionStartProgress>(
      'sessionOpening',
      sessionsKeys.start(id, failed),
      (progress) => !progress?.settled,
    ),
  });
}

/**
 * Whether a session this console watched start is still opening: its row
 * reads `open` but the agent step has not landed.
 *
 * `session.started` means the session's pane exists, which the host makes
 * before the clone, so the row turns `open` while the repository and the agent
 * are still on their way. The terminal would show a shell waiting in an empty
 * directory; the start pane, still ticking its steps, is the truer picture.
 *
 * It holds only a start this cache watched: it sent the create, or its start
 * pane read the log. A session opened from a bookmark, or long after it
 * started, goes straight to its terminal without reading the log at all.
 */
export function useSessionOpening(session: SessionEntity | undefined): boolean {
  const live = session?.isLive ?? false;
  // Watched means the log has data in the cache: the create seeded it, or the
  // start pane read it. Read through the observer, not the cache, so the
  // answer follows the query rather than whichever render read it first.
  const { data } = useSessionStartProgress(
    session?.id,
    { starting: live, failed: false },
    { enabled: (query) => query.state.data !== undefined },
  );
  return live && data !== undefined && !data.settled;
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
      // This console watches the start it sent ({@link useSessionOpening}).
      // The row can read `open` before the start pane ever mounts, since the
      // host makes the pane first, so the watch begins here and not there.
      // Stale from the outset, so the first reader fetches the log at once.
      queryClient.setQueryData(
        sessionsKeys.start(session.id, false),
        deriveSessionStartProgress([], { failed: false }),
        { updatedAt: 0 },
      );
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    }),
  });
}

/**
 * Gets a host ready for the session New session is composing: the draft's
 * repository cloned or fetched there and a spare worktree made, so pressing
 * send cuts a branch from a checkout that already exists. Nothing is cached:
 * the answer is only whether the host was told.
 */
export function usePrepareSession(
  options?: UseMutationOptions<string[], Error, PrepareSessionInput>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: (input: PrepareSessionInput) => app.sessions.prepare(input),
    ...options,
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
    // Pending until the lists have refetched, so a reader drawing the write
    // while it is in flight (a moved row) hands over to a list that has it.
    ...withCacheOnSuccess(options, (session) => {
      queryClient.setQueryData(sessionsKeys.detail(session.id), session);
      return queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
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

/**
 * Delete a session. The row leaves the lists on the click: the close is the
 * host's to carry out and can take seconds, and a reader who pressed Delete
 * is done with it. The watch ({@link closesOf}) is the one owner of that — the
 * list leaves a watched row out of every read until its host resolves it.
 *
 * Ending the watch is what brings a row back: the close is refused (by the
 * API, or because its host was offline and never got it), or the watch runs
 * out with the row still open because the host refused (unpushed work).
 */
export function useCloseSession(
  options?: UseMutationOptions<SessionEntity, Error, CloseSessionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: ({ id, acceptUnpushedWork }: CloseSessionVariables) =>
      app.sessions.close(id, acceptUnpushedWork),
    onMutate: ({ id }) => {
      watchClose(queryClient, id);
      queryClient.setQueriesData<SessionEntity[]>({ queryKey: sessionsKeys.lists() }, (rows) =>
        rows?.filter((row) => row.id !== id),
      );
    },
    onError: (error, variables, context, mutation) => {
      unwatchClose(queryClient, variables.id);
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      return options?.onError?.(error, variables, context, mutation);
    },
  });
}

/**
 * Upload a file for New session's first task. Nothing is cached: what comes
 * back is the id the create names in `attachmentIds`.
 */
export function useUploadSessionAttachment(
  options?: UseMutationOptions<SessionAttachment, Error, Blob>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: (file: Blob) => app.sessions.uploadAttachment(file),
    ...options,
  });
}

/**
 * Paste a file into one window's prompt. Nothing is cached and no key is
 * kept: success is the path appearing in the terminal, which the terminal
 * itself shows.
 */
export function usePasteSessionFile(
  sessionId: string,
  window = 0,
  options?: UseMutationOptions<void, Error, Blob>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: (file: Blob) => app.sessions.pasteFile(sessionId, file, window),
    ...options,
  });
}

/** How a session is shared, or `null`, for the people who may manage it. */
export function useSessionShare(sessionId: string) {
  return useQuery(useSessionShareQuery(sessionId));
}

/** A session's share read, for both hooks over it: the key and the fetch, once. */
function useSessionShareQuery(sessionId: string) {
  const app = useConsumerApp();
  return {
    queryKey: sessionsKeys.share(sessionId),
    queryFn: () => app.sessions.findShare(sessionId),
  };
}

/** Seeds a session's share with what a write answered, or clears it. */
function useSetShareCache() {
  const queryClient = useQueryClient();
  return (sessionId: string, share: SessionShare | null) =>
    queryClient.setQueryData(sessionsKeys.share(sessionId), share);
}

export interface PutSessionShareVariables {
  sessionId: string;
  input: PutSessionShareDto;
}

/** Share a session, or replace how it is shared; its address stays. */
export function usePutSessionShare(
  options?: UseMutationOptions<SessionShare, Error, PutSessionShareVariables>,
) {
  const app = useConsumerApp();
  const setShare = useSetShareCache();
  return useMutation({
    mutationFn: ({ sessionId, input }: PutSessionShareVariables) =>
      app.sessions.putShare(sessionId, input),
    ...withCacheOnSuccess(options, (share, { sessionId }) => setShare(sessionId, share)),
  });
}

export interface SetSessionSharePeopleVariables {
  sessionId: string;
  people: string[];
}

/** Narrow who a `people` share names; to remove the last one, stop sharing. */
export function useSetSessionSharePeople(
  options?: UseMutationOptions<SessionShare, Error, SetSessionSharePeopleVariables>,
) {
  const app = useConsumerApp();
  const setShare = useSetShareCache();
  return useMutation({
    mutationFn: ({ sessionId, people }: SetSessionSharePeopleVariables) =>
      app.sessions.setSharePeople(sessionId, people),
    ...withCacheOnSuccess(options, (share, { sessionId }) => setShare(sessionId, share)),
  });
}

export interface StopSessionShareVariables {
  sessionId: string;
}

/** Stop sharing: the address opens nothing again. */
export function useStopSessionShare(
  options?: UseMutationOptions<void, Error, StopSessionShareVariables>,
) {
  const app = useConsumerApp();
  const setShare = useSetShareCache();
  return useMutation({
    mutationFn: ({ sessionId }: StopSessionShareVariables) => app.sessions.stopShare(sessionId),
    ...withCacheOnSuccess(options, (_result, { sessionId }) => setShare(sessionId, null)),
  });
}

/** What a share's address opens for whoever is signed in, or why it does not. */
export function useSuspenseSharedSession(slug: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<SharedSession, Error>({
    queryKey: sessionsKeys.shared(slug),
    queryFn: () => app.sessions.findSharedSession(slug),
  });
}
