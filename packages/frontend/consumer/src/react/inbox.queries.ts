'use client';

import {
  useQueries,
  useSuspenseQueries,
  withCacheOnSuccess,
} from '@oppenheimer/frontend-core/react';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { RunsFilter } from '../modules/automations/automation.entity';
import { composeInbox, type InboxSources, type InboxView } from '../modules/inbox/inbox-item';
import { type InboxMark, InboxMarkEntity } from '../modules/inbox/inbox-mark.entity';
import type { ProjectEntity } from '../modules/projects/project.entity';
import { automationsKeys } from './automations.queries';
import { usePendingBotApprovalsQuery } from './bot-approvals.queries';
import { useConsumerApp } from './context';
import { inboxKeys } from './inbox.keys';
import { useProjectListQuery } from './projects.queries';
import { usePullRequestQueueQuery } from './pull-requests.queries';
import { useSessionListPoll, useSessionListQuery } from './sessions.queries';

/**
 * The failed runs the Inbox shows: the last day's (Decided 2), as many as the
 * API pages at once. One object, so its key is one key.
 */
const FAILED_RUNS: RunsFilter = { statuses: ['failed'], window: '24h', limit: 100 };

function useInboxMarksQuery() {
  const app = useConsumerApp();
  return { queryKey: inboxKeys.marks(), queryFn: () => app.inbox.findMarks() };
}

function useFailedRunsQuery() {
  const app = useConsumerApp();
  return {
    queryKey: automationsKeys.runList(FAILED_RUNS),
    queryFn: () => app.automations.findRuns(FAILED_RUNS),
  };
}

/**
 * The Inbox's seven reads, side by side: the four sources, the two pull
 * request scopes counted as one, the projects every item is filed under, and
 * the caller's marks. Each keeps its own key, poll and stream coverage, so a
 * session, a run or an approval that changes moves the Inbox with it.
 */
function useInboxQueries() {
  return [
    { ...useSessionListQuery(), ...useSessionListPoll() },
    usePendingBotApprovalsQuery(),
    usePullRequestQueueQuery('requested'),
    usePullRequestQueueQuery('mine'),
    useFailedRunsQuery(),
    useProjectListQuery(),
    useInboxMarksQuery(),
  ] as const;
}

type InboxReads = ReturnType<typeof useInboxQueries>;
type Answer<I extends number> = Awaited<ReturnType<InboxReads[I]['queryFn']>>;

/** The reads' answers as the composition takes them. */
function sourcesOf(
  sessions: Answer<0>,
  approvals: Answer<1>,
  requested: Answer<2>,
  mine: Answer<3>,
  runs: Answer<4>,
  projects: Answer<5>,
): InboxSources {
  return {
    sessions,
    approvals,
    requested: requested.items,
    mine: mine.items,
    failedRuns: runs.items,
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
 * snooze comes back on the caller's tick.
 */
export function useSuspenseInbox(
  now: number,
): InboxView & { projects: ProjectEntity[]; error: Error | null } {
  const [sessions, approvals, requested, mine, runs, projects, marks] = useSuspenseQueries({
    queries: useInboxQueries(),
  });
  const view = useMemo(
    () =>
      composeInbox(
        sourcesOf(
          sessions.data,
          approvals.data,
          requested.data,
          mine.data,
          runs.data,
          projects.data,
        ),
        marks.data,
        now,
      ),
    [
      sessions.data,
      approvals.data,
      requested.data,
      mine.data,
      runs.data,
      projects.data,
      marks.data,
      now,
    ],
  );
  const error =
    sessions.error ??
    approvals.error ??
    requested.error ??
    mine.error ??
    runs.error ??
    projects.error ??
    marks.error;
  return { ...view, projects: projects.data, error };
}

/**
 * How many things need you, for the rail; `undefined` until every read has
 * answered, so no count is drawn before it is known.
 */
export function useInboxCount(now: number): number | undefined {
  const results = useQueries({ queries: useInboxQueries() });
  const [sessions, approvals, requested, mine, runs, projects, marks] = results;
  if (
    !sessions?.data ||
    !approvals?.data ||
    !requested?.data ||
    !mine?.data ||
    !runs?.data ||
    !projects?.data ||
    !marks?.data
  ) {
    return undefined;
  }
  return composeInbox(
    sourcesOf(
      sessions.data as Answer<0>,
      approvals.data as Answer<1>,
      requested.data as Answer<2>,
      mine.data as Answer<3>,
      runs.data as Answer<4>,
      projects.data as Answer<5>,
    ),
    marks.data as InboxMarkEntity[],
    now,
  ).open.length;
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
