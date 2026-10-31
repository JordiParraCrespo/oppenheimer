'use client';

import {
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
  withCacheOnSuccess,
} from '@oppenheimer/frontend-core/react';
import type { AnswerSessionDecisionDto } from '@oppenheimer/shared/schemas/session-decision';
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
  SessionPorts,
  SessionPreview,
  SessionShare,
  SharedSession,
  StartCloudSessionInput,
} from '../modules/sessions/session.entity';
import {
  deriveSessionStartProgress,
  type SessionStartProgress,
} from '../modules/sessions/session-steps';
import { useConsumerApp } from './context';
import { useHostListQuery } from './hosts.queries';
import {
  CLOSE_WATCH_MS,
  eitherPoll,
  type PollKeys,
  RESTART_WATCH_MS,
  usePollWhile,
} from './live-poll';
import { mutation } from './mutation';
import { useProjectListQuery } from './projects.queries';
import { seedDetails } from './seed-details';
import { sessionsKeys } from './sessions.keys';

/**
 * The sessions a console asked to close and has not yet seen resolve, each
 * with the timer that ends its watch — per `QueryClient`, so the watch lives
 * and dies with the cache it keeps polling, and two clients never share one.
 *
 * A close is answered by the host, not by the request, so the row stays `open`
 * for a beat after Delete. The list leaves a watched row out from the click
 * (the reader asked for it gone, and an online host answers in seconds) and
 * polls on `LIVE_POLL.sessionStarting` until the host resolves it.
 *
 * The watch ends early when there is nothing to wait for: the API answers that
 * the host is offline, or a read shows the host refused the close. It ends
 * anyway after {@link CLOSE_WATCH_MS}. A row that comes back is never back as
 * it was: the API folds the close it still owes its host (`closeRequest`,
 * drawn as "Deleting…" and sent again when the host reconnects) and the host's
 * refusal (`closeRefusal`), so the reader sees why it is still there.
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
        const row = unresolved.find((session) => session.id === id);
        // Resolved, or refused by its host: either way the host has answered,
        // and a refused row comes back saying so.
        if (!row || row.closeRefusal) unwatchClose(queryClient, id);
      }
      return unresolved.filter((session) => !closing.has(session.id));
    },
  };
}

/**
 * Over the query's own rows, before any caller's `select`. Two polls, the
 * faster answering: a row being built or deleted, which stands down while
 * the workspace event stream carries every change to these rows, and a
 * cloud session whose vendor is still working, which the stream never
 * carries (`cloudSession`).
 */
export function useSessionListPoll() {
  const queryClient = useQueryClient();
  const starting = usePollWhile<SessionEntity[]>(
    'sessionStarting',
    sessionsKeys.list(),
    (rows) =>
      closesOf(queryClient).size > 0 || (rows?.some((session) => session.isProvisioning) ?? false),
  );
  const cloud = usePollWhile<SessionEntity[]>(
    'cloudSession',
    sessionsKeys.list(),
    (rows) => rows?.some((session) => session.isCloudWorking) ?? false,
  );
  return eitherPoll(starting, cloud);
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
  const opening = usePollWhile<SessionEntity>(
    'sessionOpening',
    sessionsKeys.detail(id),
    (session) =>
      (!session?.isCloud && (session?.isProvisioning ?? false)) || restartsOf(queryClient).has(id),
  );
  // A cloud session's page follows its vendor's run, which no host reports.
  const cloud = usePollWhile<SessionEntity>(
    'cloudSession',
    sessionsKeys.detail(id),
    (session) => session?.isCloudWorking ?? false,
  );
  return eitherPoll(opening, cloud);
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

/**
 * This console watches the start it sent ({@link useSessionOpening}), so the
 * session's pane stays on its steps until the agent runs. The row can read
 * `open` before the start pane ever mounts, since the host makes the pane
 * first, so the watch begins with the answer to the create and not with the
 * pane. Stale from the outset, so the first reader fetches the log at once.
 * Every start a console sends calls it: New session's and a pull request's
 * review session.
 */
export function watchSessionStart(queryClient: QueryClient, sessionId: string): void {
  queryClient.setQueryData(
    sessionsKeys.start(sessionId, false),
    deriveSessionStartProgress([], { failed: false }),
    { updatedAt: 0 },
  );
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

export const useCreateSession = mutation<SessionEntity, CreateSessionVariables>({
  run: (app, { input, idempotencyKey }) => app.sessions.create(input, idempotencyKey),
  update: (queryClient, session) => {
    // The row the API just answered with, put where the session screen reads
    // it. Without this the screen the caller navigates to opens `pending`,
    // draws its skeleton and fetches the session it was handed a moment ago:
    // a round trip on the critical path between pressing send and the
    // terminal mounting, which is the one stretch a reader is watching. Every
    // other session mutation already seeds it ({@link useSessionPatch});
    // create was the one that did not.
    queryClient.setQueryData(sessionsKeys.detail(session.id), session);
    watchSessionStart(queryClient, session.id);
    queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
  },
});

export interface StartCloudSessionVariables {
  input: StartCloudSessionInput;
  /** One per send, kept across its retries, so a retry returns the session already started. */
  idempotencyKey: string;
}

/**
 * Starts a session in a vendor's cloud. The answer is the session, listed at
 * once with the others; its row opens the vendor's page.
 */
export const useStartCloudSession = mutation<SessionEntity, StartCloudSessionVariables>({
  run: (app, { input, idempotencyKey }) => app.sessions.startCloud(input, idempotencyKey),
  update: (queryClient, session) => {
    queryClient.setQueryData(sessionsKeys.detail(session.id), session);
    return queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
  },
});

/**
 * Gets a host ready for the session New session is composing: the draft's
 * repository cloned or fetched there and a spare worktree made, so pressing
 * send cuts a branch from a checkout that already exists. Nothing is cached:
 * the answer is only whether the host was told.
 */
export const usePrepareSession = mutation<string[], PrepareSessionInput>({
  run: (app, input) => app.sessions.prepare(input),
});

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

export interface AnswerSessionDecisionVariables {
  sessionId: string;
  /** `{ id, answers }` for a question, `{ id, option }` for a permission. */
  answer: AnswerSessionDecisionDto;
}

/** The API's refusal of an answer to a decision that is no longer the pending one. */
const DECISION_STALE = 'SESSIONS_032';

/**
 * Answer what a session's agent waits on, from outside its terminal (the
 * Inbox): the API types the keys and clears the decision. The row the API
 * answers replaces the session's in every list at once, so what drew the
 * decision stops drawing it, and the lists are read again behind it. An
 * answer refused as stale (answered elsewhere, or the agent asks something
 * else now) reads the session again, so the new decision shows.
 */
export function useAnswerSessionDecision(
  options?: UseMutationOptions<SessionEntity, Error, AnswerSessionDecisionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, answer }: AnswerSessionDecisionVariables) =>
      app.sessions.answerDecision(sessionId, answer),
    ...withCacheOnSuccess(options, (session) => {
      queryClient.setQueryData(sessionsKeys.detail(session.id), session);
      queryClient.setQueriesData<SessionEntity[]>({ queryKey: sessionsKeys.lists() }, (rows) =>
        rows?.map((row) => (row.id === session.id ? session : row)),
      );
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    }),
    onError: (error, variables, context, mutation) => {
      if ((error as { code?: string }).code === DECISION_STALE) {
        void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(variables.sessionId) });
        void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      }
      return options?.onError?.(error, variables, context, mutation);
    },
  });
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
export const useRestartSession = mutation<SessionEntity, string>({
  run: (app, id) => app.sessions.restart(id),
  update: (queryClient, session) => {
    queryClient.setQueryData(sessionsKeys.detail(session.id), session);
    queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    // A restart is a request; the row is still stopped until the host says
    // otherwise, so the detail reads until it does.
    watchRestart(queryClient, session.id);
  },
});

/**
 * Delete a session. The row leaves the lists on the click: the close is the
 * host's to carry out and can take seconds, and a reader who pressed Delete
 * is done with it. The watch ({@link closesOf}) is the one owner of that — the
 * list leaves a watched row out of every read until its host resolves it.
 *
 * Ending the watch is what brings a row back: the API refuses the close, the
 * API answers that the host is offline (the row is back at once, deleting until
 * the host reconnects and is sent the close again), the host refuses it
 * (unpushed work: the row is back with the refusal, to delete again accepting
 * the loss), or the watch runs out with the row still deleting.
 */
export function useCloseSession(
  options?: UseMutationOptions<SessionEntity, Error, CloseSessionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    ...withCacheOnSuccess(options, (session) => {
      queryClient.setQueryData(sessionsKeys.detail(session.id), session);
      // Nobody will answer within the watch: show the row deleting now.
      if (session.isHostOffline) {
        unwatchClose(queryClient, session.id);
        void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      }
    }),
    mutationFn: ({ id, acceptUnpushedWork }: CloseSessionVariables) =>
      app.sessions.close(id, acceptUnpushedWork),
    onMutate: async ({ id }) => {
      watchClose(queryClient, id);
      // A read already in flight answers from before the close was recorded,
      // and could end the watch on the last refusal this close replaces.
      await queryClient.cancelQueries({ queryKey: sessionsKeys.lists() });
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
export const useUploadSessionAttachment = mutation<SessionAttachment, Blob>({
  run: (app, file) => app.sessions.uploadAttachment(file),
});

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

/**
 * The ports a session listens on, for its Browser tab: polled while the tab
 * is open, so a dev server the agent just started shows on its own. An
 * offline host, or a runner that cannot list, is the answer's `state`, not a
 * failure.
 */
export function useSuspenseSessionPorts(sessionId: string) {
  const app = useConsumerApp();
  const queryKey = sessionsKeys.ports(sessionId);
  const poll = usePollWhile<SessionPorts>('sessionPorts', queryKey, true);
  return useSuspenseQuery({
    queryKey,
    queryFn: () => app.sessions.findPorts(sessionId),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    ...poll,
  });
}

/**
 * Where the Browser tab frames one of the session's ports. A query, though
 * minting writes, like `useCurrentPairing`: the frame needs exactly one URL
 * per port it shows. The ticket in it is single use, so it is never
 * refetched or kept past the frame: Reload asks again with a new `opened`.
 */
export function useSuspenseSessionPreview(sessionId: string, port: number, opened: number) {
  const app = useConsumerApp();
  return useSuspenseQuery<SessionPreview>({
    queryKey: sessionsKeys.preview(sessionId, port, opened),
    queryFn: () => app.sessions.openPreview(sessionId, { port, embed: true }),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Open in a new tab: a URL of its own for one of the session's ports, outside
 * the console's frame. Nothing cached changes.
 */
export const useOpenSessionPreviewTab = mutation<
  SessionPreview,
  { sessionId: string; port: number; path?: string }
>({
  run: (app, { sessionId, port, path }) =>
    app.sessions.openPreview(sessionId, { port, path, embed: false }),
});
