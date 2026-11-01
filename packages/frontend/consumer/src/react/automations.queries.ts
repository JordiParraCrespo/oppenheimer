'use client';

import {
  shareEntities,
  useQuery,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@oppenheimer/frontend-core/react';
import {
  keepPreviousData,
  type QueryClient,
  type QueryKey,
  skipToken,
  type UseQueryOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { CONSUMER_CONFIG } from '../config';
import type {
  AutomationEntity,
  AutomationInput,
  AutomationRunEntity,
  RunHistory,
  RunHistoryFilter,
  RunPage,
  RunsFilter,
  TriggerInput,
  TriggerPreview,
  UpdateAutomationInput,
} from '../modules/automations/automation.entity';
import { automationsKeys } from './automations.keys';
import { useConsumerApp } from './context';
import { type PollKeys, usePollWhile } from './live-poll';
import { mutation } from './mutation';
import { useProjectListQuery } from './projects.queries';
import { seedDetails } from './seed-details';

type GithubTriggerInput = Extract<TriggerInput, { source: 'github' }>;

/**
 * The workspace's automations, oldest first: the sidebar's groups and the
 * overview's table read the same list. Each carries its status, its next run
 * and its last six runs, and is the same document as its detail, which it
 * fills (`seedDetails`).
 */
export function useAutomations<TData = AutomationEntity[]>(
  options?: Omit<
    UseQueryOptions<AutomationEntity[], Error, TData>,
    'queryKey' | 'queryFn' | PollKeys
  >,
) {
  return useQuery<AutomationEntity[], Error, TData>({
    ...useAutomationListQuery(),
    ...options,
    ...useAutomationListPoll(),
  });
}

/**
 * {@link useAutomations} for a section under a Suspense `QueryState`: the
 * same list, seeding the same details, polling while a run is live, and
 * `data` is always the automations.
 */
export function useSuspenseAutomations() {
  return useSuspenseQuery<AutomationEntity[], Error>({
    ...useAutomationListQuery(),
    ...useAutomationListPoll(),
  });
}

/**
 * The automations and the projects they are grouped under, under a Suspense
 * `QueryState`, fetched side by side: the sidebar's groups and the runs
 * list's facets.
 * `error` is the first refetch that failed over data already drawn.
 */
export function useSuspenseAutomationsByProject() {
  const [automations, projects] = useSuspenseQueries({
    queries: [{ ...useAutomationListQuery(), ...useAutomationListPoll() }, useProjectListQuery()],
  });
  return {
    automations: automations.data,
    projects: projects.data,
    error: automations.error ?? projects.error,
  };
}

/** The automations read, for both hooks over it: the key, and a fetch that fills each detail. */
function useAutomationListQuery() {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return {
    queryKey: automationsKeys.list(),
    queryFn: async () => {
      const askedAt = Date.now();
      const automations = await app.automations.findAll();
      seedDetails(queryClient, automations, automationsKeys.detail, askedAt);
      return automations;
    },
  };
}

/** The list polls while any of its automations has a run going. */
function useAutomationListPoll() {
  return usePollWhile<AutomationEntity[]>(
    'liveRun',
    automationsKeys.list(),
    (rows) => rows?.some((automation) => automation.isRunning) ?? false,
  );
}

/**
 * One automation under a Suspense `QueryState`, polling while one of its runs
 * is going; `data` is always the automation.
 */
export function useSuspenseAutomation(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<AutomationEntity, Error>({
    queryKey: automationsKeys.detail(id),
    queryFn: () => app.automations.findById(id),
    ...useAutomationPoll(id),
  });
}

/** An automation polls while one of its runs is going. */
function useAutomationPoll(id: string) {
  return usePollWhile<AutomationEntity>(
    'liveRun',
    automationsKeys.detail(id),
    (automation) => automation?.isRunning ?? false,
  );
}

/**
 * A page of runs under the filters: the Runs tab, and an automation's page.
 * The previous page stays on screen while the next loads, so paging and a
 * status pill never flash the list empty.
 */
/**
 * A page of runs under a Suspense `QueryState`, polling while one is live.
 * A new filter is a new key, which suspends: the list reads its filter
 * through `useDeferredValue`, so the page on screen stays until the next one
 * has answered.
 */
export function useSuspenseAutomationRuns(filter: RunsFilter) {
  const app = useConsumerApp();
  return useSuspenseQuery<RunPage, Error>({
    queryKey: automationsKeys.runList(filter),
    queryFn: () => app.automations.findRuns(filter),
    ...usePollWhile<RunPage>(
      'liveRun',
      automationsKeys.runList(filter),
      (page) => page?.items.some((run) => run.isLive) ?? false,
    ),
  });
}

/**
 * The run-history chart under a Suspense `QueryState`: one bar per local day
 * of the viewer's zone.
 */
export function useSuspenseRunHistory(filter: RunHistoryFilter) {
  const app = useConsumerApp();
  return useSuspenseQuery<RunHistory, Error>({
    queryKey: automationsKeys.history(filter),
    queryFn: () => app.automations.history(filter),
  });
}

/**
 * What a GitHub trigger card would have matched in the last week: the
 * editor's live line under the card. Pass `undefined` while the card is not
 * complete enough to ask.
 */
export function useTriggerPreview(trigger: GithubTriggerInput | undefined) {
  const app = useConsumerApp();
  return useQuery<TriggerPreview, Error>({
    queryKey: automationsKeys.preview(trigger),
    queryFn: trigger ? () => app.automations.previewTrigger(trigger) : skipToken,
    placeholderData: keepPreviousData,
    staleTime: CONSUMER_CONFIG.automations.triggerPreviewStaleMs,
  });
}

/**
 * What an automations write refreshes. An answer that is the automation's row
 * replaces its detail and its list row. A new automation has no list row yet,
 * so the list is read again. Runs are read again only by a write that can
 * change a run row: an update (every row carries the automation's name), a
 * run, a delete. Nothing touches the trigger preview, which reads GitHub.
 * Reads of the rows it writes that are already in flight are cancelled first,
 * so an answer from before the write cannot land on top of it.
 */
type AutomationWrite =
  | { saved: AutomationEntity; runs: boolean }
  | { added: AutomationEntity }
  | { removed: string }
  | { ran: string };

async function settleAutomation(queryClient: QueryClient, write: AutomationWrite) {
  const refetch = (...keys: QueryKey[]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  if ('saved' in write) {
    const { saved, runs } = write;
    await Promise.all([
      queryClient.cancelQueries({ queryKey: automationsKeys.detail(saved.id), exact: true }),
      // A list still on its first read has no row to write, and is left to land.
      queryClient.cancelQueries({
        queryKey: automationsKeys.list(),
        exact: true,
        predicate: (query) => query.state.data !== undefined,
      }),
    ]);
    queryClient.setQueryData(automationsKeys.detail(saved.id), saved);
    queryClient.setQueryData<AutomationEntity[]>(automationsKeys.list(), (rows) =>
      rows?.map((row) => (row.id === saved.id ? shareEntities(row, saved) : row)),
    );
    return runs ? refetch(automationsKeys.runs()) : undefined;
  }
  if ('added' in write) {
    queryClient.setQueryData(automationsKeys.detail(write.added.id), write.added);
    return refetch(automationsKeys.lists());
  }
  if ('removed' in write) {
    queryClient.removeQueries({ queryKey: automationsKeys.detail(write.removed), exact: true });
    return refetch(automationsKeys.lists(), automationsKeys.runs());
  }
  return refetch(
    automationsKeys.detail(write.ran),
    automationsKeys.lists(),
    automationsKeys.runs(),
  );
}

export const useCreateAutomation = mutation<AutomationEntity, AutomationInput>({
  run: (app, input) => app.automations.create(input),
  update: (queryClient, added) => settleAutomation(queryClient, { added }),
});

export interface UpdateAutomationVariables {
  id: string;
  input: UpdateAutomationInput;
}

export const useUpdateAutomation = mutation<AutomationEntity, UpdateAutomationVariables>({
  run: (app, { id, input }) => app.automations.update(id, input),
  update: (queryClient, saved) => settleAutomation(queryClient, { saved, runs: true }),
});

export interface PauseAutomationVariables {
  id: string;
  paused: boolean;
}

/** Pause or resume: triggers are ignored while paused, and Run now still works. */
export const useSetAutomationPaused = mutation<AutomationEntity, PauseAutomationVariables>({
  run: (app, { id, paused }) => (paused ? app.automations.pause(id) : app.automations.resume(id)),
  update: (queryClient, saved) => settleAutomation(queryClient, { saved, runs: false }),
});

/** Duplicate: the copy is the caller's, and starts paused only if the original was. */
export const useDuplicateAutomation = mutation<AutomationEntity, string>({
  run: (app, id) => app.automations.duplicate(id),
  update: (queryClient, added) => settleAutomation(queryClient, { added }),
});

/**
 * Delete: its triggers stop now, and its past runs are kept. The deleted
 * automation's own read is dropped rather than left stale, so nothing asks
 * the API again for a row that is gone.
 */
export const useDeleteAutomation = mutation<void, string>({
  run: (app, id) => app.automations.remove(id),
  update: (queryClient, _data, removed) => settleAutomation(queryClient, { removed }),
});

export interface RunAutomationVariables {
  id: string;
  /** One per click: a retried request with the same key is the same run. */
  idempotencyKey: string;
}

/** Run now, whether or not the automation is paused. */
export const useRunAutomation = mutation<AutomationRunEntity, RunAutomationVariables>({
  run: (app, { id, idempotencyKey }) => app.automations.run(id, idempotencyKey),
  update: (queryClient, _run, { id }) => settleAutomation(queryClient, { ran: id }),
});
