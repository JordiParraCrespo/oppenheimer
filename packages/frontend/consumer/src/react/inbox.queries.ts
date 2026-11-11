'use client';

import {
  useQueries,
  useSuspenseQueries,
  withCacheOnSuccess,
} from '@oppenheimer/frontend-core/react';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { RunsFilter } from '../modules/automations/automation.entity';
import { composeInbox, type InboxSources, type InboxView } from '../modules/inbox/inbox-item';
import { type InboxMark, InboxMarkEntity } from '../modules/inbox/inbox-mark.entity';
import type { InboxReportEntity } from '../modules/inbox/inbox-report.entity';
import type { ProjectEntity } from '../modules/projects/project.entity';
import { automationsKeys } from './automations.keys';
import { usePendingBotApprovalsQuery } from './bot-approvals.queries';
import { useBotNoticesQuery } from './bot-notices.queries';
import { useConsumerApp } from './context';
import { inboxKeys } from './inbox.keys';
import { pollWhile } from './live-poll';
import { useProjectListQuery } from './projects.queries';
import { usePullRequestQueueQuery } from './pull-requests.queries';
import { useSessionListPoll, useSessionListQuery } from './sessions.queries';

/**
 * The failed runs the Inbox shows: the last day's (Decided 2), as many as the
 * API pages at once. One object, so its key is one key.
 */
const FAILED_RUNS: RunsFilter = { statuses: ['failed'], window: '24h', limit: 100 };

/**
 * The occurrences answered from this tab whose source has not caught up yet:
 * an approval decided, a pull request merged, a run started again, a
 * session's decision answered while its agent still reads as blocked until
 * its host reports. They leave the Inbox on the click; the list, its count,
 * the bar's and the rail's all read them here, so no count holds an item the
 * list no longer shows. The Inbox clears them when the reader leaves it.
 */
let answeredKeys: ReadonlySet<string> = new Set();
const answeredListeners = new Set<() => void>();

function setAnswered(next: ReadonlySet<string>): void {
  answeredKeys = next;
  for (const listener of answeredListeners) listener();
}

export const inboxAnswered = {
  add(...keys: string[]): void {
    setAnswered(new Set([...answeredKeys, ...keys]));
  },
  clear(): void {
    if (answeredKeys.size > 0) setAnswered(new Set());
  },
};

function useAnsweredKeys(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      answeredListeners.add(listener);
      return () => answeredListeners.delete(listener);
    },
    () => answeredKeys,
    () => answeredKeys,
  );
}

/**
 * Whether the Inbox lists pull requests (a review asked of you, yours ready
 * to merge), kept on this device. Off unless the reader turns it on: the
 * agents open pull requests under the reader's account, so every one of
 * them would wait here as theirs to merge (`29-inbox.md`, "Pull requests
 * are opt-in"). Off, their two reads are not made at all. One value for the
 * page, so the list and every count agree the moment it flips.
 */
const PULLS_KEY = 'oppenheimer.inbox.pulls';
let pullsShown: boolean | undefined;
const pullsListeners = new Set<() => void>();

function readPullsShown(): boolean {
  if (pullsShown === undefined) {
    try {
      pullsShown = globalThis.localStorage?.getItem(PULLS_KEY) === 'true';
    } catch {
      pullsShown = false;
    }
  }
  return pullsShown;
}

function setPullsShown(shown: boolean): void {
  if (readPullsShown() === shown) return;
  pullsShown = shown;
  try {
    globalThis.localStorage?.setItem(PULLS_KEY, String(shown));
  } catch {
    // Kept in memory above; storage refused it.
  }
  for (const listener of pullsListeners) listener();
}

/** Whether the Inbox lists pull requests, and the switch the filter menu flips. */
export function useInboxPullsShown(): [shown: boolean, setShown: (shown: boolean) => void] {
  const shown = useSyncExternalStore(
    (listener) => {
      pullsListeners.add(listener);
      return () => pullsListeners.delete(listener);
    },
    readPullsShown,
    () => false,
  );
  return [shown, setPullsShown];
}

function useInboxMarksQuery() {
  const app = useConsumerApp();
  return { queryKey: inboxKeys.marks(), queryFn: () => app.inbox.findMarks() };
}

/** The open reports (`29-inbox.md`, "Reports"); `inboxReport.changed` refetches them. */
function useInboxReportsQuery() {
  const app = useConsumerApp();
  return { queryKey: inboxKeys.reports(), queryFn: () => app.inbox.findReports() };
}

function useFailedRunsQuery() {
  const app = useConsumerApp();
  return {
    queryKey: automationsKeys.runList(FAILED_RUNS),
    queryFn: () => app.automations.findRuns(FAILED_RUNS),
  };
}

/**
 * The Inbox's reads, side by side: the sources, the projects every item is
 * filed under, and the caller's marks. The two pull request scopes, counted
 * as one source, follow on only while pull requests are shown. Each keeps
 * its own key, poll and stream coverage, so a session, a run, an approval, a
 * bot's notice or a report that changes moves the Inbox with it.
 */
function useInboxQueries() {
  return [
    { ...useSessionListQuery(), ...useSessionListPoll() },
    usePendingBotApprovalsQuery(),
    useFailedRunsQuery(),
    useBotNoticesQuery(),
    useInboxReportsQuery(),
    useProjectListQuery(),
    useInboxMarksQuery(),
  ] as const;
}

/** The pull request scopes the Inbox reads: none while they are hidden. */
function usePullQueries(shown: boolean) {
  const requested = usePullRequestQueueQuery('requested');
  const mine = usePullRequestQueueQuery('mine');
  return shown ? [requested, mine] : [];
}

/**
 * The `inbox` poll over every read, as observers of their own: a read's
 * own poll keeps its pace and its hidden-tab bit, and this one pauses on a
 * hidden tab whatever those say. It draws nothing, so it never re-renders.
 */
function useInboxPoll(pulls: boolean) {
  const pullQueries = usePullQueries(pulls);
  useQueries({
    queries: [...useInboxQueries(), ...pullQueries].map(({ queryKey, queryFn }) => ({
      queryKey,
      queryFn,
      ...pollWhile('inbox', true),
    })),
    combine: () => null,
  });
}

type InboxReads = ReturnType<typeof useInboxQueries>;
type Answer<I extends number> = Awaited<ReturnType<InboxReads[I]['queryFn']>>;
type PullAnswer = Awaited<ReturnType<ReturnType<typeof usePullQueries>[number]['queryFn']>>;

/** What the pull request reads answered, by scope: none while they are hidden or still out. */
interface PullSources {
  requested: InboxSources['requested'];
  mine: InboxSources['mine'];
}

/** The pull request reads' answers by scope, in `usePullQueries`'s order; the one place that order is read. */
function pullSources(answers: readonly (PullAnswer | undefined)[]): PullSources {
  const [requested, mine] = answers;
  return { requested: requested?.items ?? [], mine: mine?.items ?? [] };
}

/** The reads' answers as the composition takes them. */
function sourcesOf(
  sessions: Answer<0>,
  approvals: Answer<1>,
  runs: Answer<2>,
  botNotices: Answer<3>,
  reports: Answer<4>,
  projects: Answer<5>,
  pulls: PullSources,
): InboxSources {
  return {
    sessions,
    approvals,
    ...pulls,
    failedRuns: runs.items,
    botNotices,
    reports,
    projects,
  };
}

/**
 * The Inbox under a Suspense `QueryState`, after the caller's marks at `now`
 * (a snooze that has ended no longer hides its item): what needs you in
 * order, what you marked done that still does, what is snoozed, and the
 * projects the items are filed under (the Project facet's names). `error`
 * is the first refetch that failed over data already drawn.
 *
 * `now` comes from the caller's clock (`useNow`), never read here, so a
 * snooze comes back on the caller's tick. Every read polls as `inbox` while
 * it is mounted (`useInboxPoll`).
 */
export function useSuspenseInbox(
  now: number,
): InboxView & { projects: ProjectEntity[]; answered: ReadonlySet<string>; error: Error | null } {
  const [pullsShown] = useInboxPullsShown();
  useInboxPoll(pullsShown);
  const pullQueries = usePullQueries(pullsShown);
  const [sessions, approvals, runs, botNotices, reports, projects, marks] = useSuspenseQueries({
    queries: useInboxQueries(),
  });
  const pullResults = useSuspenseQueries({ queries: pullQueries });
  const [requested, mine] = pullResults.map((result) => result.data);
  const answered = useAnsweredKeys();
  const view = useMemo(
    () =>
      composeInbox(
        sourcesOf(
          sessions.data,
          approvals.data,
          runs.data,
          botNotices.data,
          reports.data,
          projects.data,
          pullSources([requested, mine]),
        ),
        marks.data,
        now,
        answered,
      ),
    [
      sessions.data,
      approvals.data,
      runs.data,
      botNotices.data,
      reports.data,
      projects.data,
      requested,
      mine,
      marks.data,
      now,
      answered,
    ],
  );
  const error =
    sessions.error ??
    approvals.error ??
    pullResults.find((result) => result.error)?.error ??
    runs.error ??
    botNotices.error ??
    reports.error ??
    projects.error ??
    marks.error;
  return { ...view, projects: projects.data, answered, error };
}

/**
 * How many things need you, for the rail; `undefined` until every read has
 * answered, so no count is drawn before it is known.
 */
export function useInboxCount(now: number): number | undefined {
  const [pullsShown] = useInboxPullsShown();
  const results = useQueries({ queries: useInboxQueries() });
  const pullResults = useQueries({ queries: usePullQueries(pullsShown) });
  const answered = useAnsweredKeys();
  const [sessions, approvals, runs, botNotices, reports, projects, marks] = results;
  if (
    !sessions?.data ||
    !approvals?.data ||
    !runs?.data ||
    !botNotices?.data ||
    !reports?.data ||
    !projects?.data ||
    !marks?.data ||
    pullResults.some((result) => !result.data)
  ) {
    return undefined;
  }
  return composeInbox(
    sourcesOf(
      sessions.data as Answer<0>,
      approvals.data as Answer<1>,
      runs.data as Answer<2>,
      botNotices.data as Answer<3>,
      reports.data as Answer<4>,
      projects.data as Answer<5>,
      pullSources(pullResults.map((result) => result.data as PullAnswer)),
    ),
    marks.data as InboxMarkEntity[],
    now,
    answered,
  ).open.length;
}

/**
 * Reads the Inbox again now, every source at once, for its Refresh button;
 * `refreshing` holds while any of them is still answering. A read that fails
 * shows as the Inbox's `error`, as a poll's would.
 */
export function useRefreshInbox(): { refresh: () => void; refreshing: boolean } {
  const queryClient = useQueryClient();
  const [pullsShown] = useInboxPullsShown();
  const pullQueries = usePullQueries(pullsShown);
  const keys = [...useInboxQueries(), ...pullQueries].map((query) => query.queryKey);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    void Promise.all(
      keys.map((queryKey) => queryClient.refetchQueries({ queryKey, exact: true })),
    ).finally(() => setRefreshing(false));
  };
  return { refresh, refreshing };
}

export interface PutInboxMarkVariables {
  itemKey: string;
  mark: InboxMark;
  /** With a snooze, and only with one. */
  until?: Date;
}

interface MarksContext {
  previous?: InboxMarkEntity[];
}

/**
 * Writes the marks list at once, so the row moves on the click, and returns
 * what it held so a refusal can put it back.
 */
async function writeMarks(
  queryClient: ReturnType<typeof useQueryClient>,
  update: (marks: InboxMarkEntity[]) => InboxMarkEntity[],
): Promise<MarksContext> {
  const cancelled = queryClient.cancelQueries({ queryKey: inboxKeys.marks() });
  const previous = queryClient.getQueryData<InboxMarkEntity[]>(inboxKeys.marks());
  queryClient.setQueryData<InboxMarkEntity[]>(inboxKeys.marks(), (marks) =>
    marks ? update(marks) : marks,
  );
  await cancelled;
  return { previous };
}

function restoreMarks(queryClient: ReturnType<typeof useQueryClient>, context?: MarksContext) {
  if (context?.previous) queryClient.setQueryData(inboxKeys.marks(), context.previous);
  void queryClient.invalidateQueries({ queryKey: inboxKeys.marks() });
}

/**
 * Marks one occurrence done, low, snoozed or deleted (§3). The list moves on
 * the click; the server's mark replaces the provisional one, and a refusal
 * puts the list back.
 */
export function usePutInboxMark(
  options?: UseMutationOptions<InboxMarkEntity, Error, PutInboxMarkVariables, MarksContext>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    ...withCacheOnSuccess(options, (saved) => {
      queryClient.setQueryData<InboxMarkEntity[]>(inboxKeys.marks(), (marks) => [
        ...(marks ?? []).filter((mark) => mark.itemKey !== saved.itemKey),
        saved,
      ]);
    }),
    mutationFn: ({ itemKey, mark, until }: PutInboxMarkVariables) =>
      app.inbox.putMark(itemKey, mark, until),
    onMutate: ({ itemKey, mark, until }) =>
      writeMarks(queryClient, (marks) => [
        ...marks.filter((row) => row.itemKey !== itemKey),
        new InboxMarkEntity(itemKey, mark, until ?? null, new Date()),
      ]),
    onError: (error, variables, context, mutation) => {
      restoreMarks(queryClient, context);
      return options?.onError?.(error, variables, context, mutation);
    },
  });
}

/** Clears an occurrence's mark: Bring back, Restore priority. Moves on the click, as a put does. */
export function useDeleteInboxMark(
  options?: UseMutationOptions<void, Error, string, MarksContext>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    ...withCacheOnSuccess(options, () =>
      queryClient.invalidateQueries({ queryKey: inboxKeys.marks() }),
    ),
    mutationFn: (itemKey: string) => app.inbox.deleteMark(itemKey),
    onMutate: (itemKey) =>
      writeMarks(queryClient, (marks) => marks.filter((row) => row.itemKey !== itemKey)),
    onError: (error, itemKey, context, mutation) => {
      restoreMarks(queryClient, context);
      return options?.onError?.(error, itemKey, context, mutation);
    },
  });
}

export interface PutInboxMarksVariables {
  itemKeys: readonly string[];
  /** `null` clears each one's mark (Restore priority on a selection). */
  mark: InboxMark | null;
  /** With a snooze, and only with one. */
  until?: Date;
}

/**
 * Marks a selection at once (`POST /inbox/marks/batch`): one write to the
 * cached list, so every row moves on the click, then one request for all of
 * them. The API checks every key and writes them in one transaction, so a
 * refusal puts the list back as it was.
 */
export function usePutInboxMarks(
  options?: UseMutationOptions<InboxMarkEntity[], Error, PutInboxMarksVariables, MarksContext>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    // Only the selection's rows take the server's answer: another mark still
    // in flight keeps its provisional row.
    ...withCacheOnSuccess(options, (saved, { itemKeys }) => {
      const keys = new Set(itemKeys);
      queryClient.setQueryData<InboxMarkEntity[]>(inboxKeys.marks(), (marks) => [
        ...(marks ?? []).filter((mark) => !keys.has(mark.itemKey)),
        ...saved.filter((mark) => keys.has(mark.itemKey)),
      ]);
    }),
    mutationFn: ({ itemKeys, mark, until }: PutInboxMarksVariables) =>
      app.inbox.putMarks(itemKeys, mark, until),
    onMutate: ({ itemKeys, mark, until }) => {
      const keys = new Set(itemKeys);
      return writeMarks(queryClient, (marks) => [
        ...marks.filter((row) => !keys.has(row.itemKey)),
        ...(mark === null
          ? []
          : itemKeys.map(
              (itemKey) => new InboxMarkEntity(itemKey, mark, until ?? null, new Date()),
            )),
      ]);
    },
    onError: (error, variables, context, mutation) => {
      restoreMarks(queryClient, context);
      return options?.onError?.(error, variables, context, mutation);
    },
  });
}

/** A report's pictures, as `useInboxReportImages` reads them: each one's bytes once they are in. */
export interface InboxReportImageReads {
  blobs: readonly (Blob | undefined)[];
  /** Which could not be read, by position. */
  failed: readonly boolean[];
}

/** Module-level, so TanStack keeps the combined value while no read changes. */
function combineImages(
  results: { data: Blob | undefined; isError: boolean }[],
): InboxReportImageReads {
  return {
    blobs: results.map((result) => result.data),
    failed: results.map((result) => result.isError),
  };
}

/**
 * The pictures one report carries, each its bytes as a `Blob`, in order, for
 * its card to draw and open. They never change under an id, so they are read
 * once; like everything under `inbox`, they are never written to the
 * persisted cache.
 */
export function useInboxReportImages(reportId: string, imageIds: readonly string[]) {
  const app = useConsumerApp();
  return useQueries({
    queries: imageIds.map((imageId) => ({
      queryKey: inboxKeys.reportImage(reportId, imageId),
      queryFn: () => app.inbox.readReportImage(reportId, imageId),
      staleTime: Number.POSITIVE_INFINITY,
      structuralSharing: false,
    })),
    combine: combineImages,
  });
}

export interface AnswerInboxReportVariables {
  id: string;
  text: string;
}

/**
 * Answers a report from its card. The answered report replaces its row, so
 * it leaves the Inbox without waiting for the stream to say so. A refusal
 * reads the reports again: the one refusal a reader meets is a report
 * answered somewhere else first (`INBOX_006`), which is no longer theirs to
 * answer.
 */
export function useAnswerInboxReport(
  options?: UseMutationOptions<InboxReportEntity, Error, AnswerInboxReportVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    ...withCacheOnSuccess(options, (answered) => {
      queryClient.setQueryData<InboxReportEntity[]>(inboxKeys.reports(), (reports) =>
        reports?.map((report) => (report.id === answered.id ? answered : report)),
      );
    }),
    mutationFn: ({ id, text }: AnswerInboxReportVariables) => app.inbox.answerReport(id, text),
    onError: (error, variables, context, mutation) => {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.reports() });
      return options?.onError?.(error, variables, context, mutation);
    },
  });
}
