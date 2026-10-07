'use client';

import { shareEntities, useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  keepPreviousData,
  type QueryClient,
  type QueryKey,
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
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
import { useConsumerApp } from './context';
import { type PollKeys, usePollWhile } from './live-poll';
import { seedDetails } from './seed-details';

/** Query key factory for the `automations` feature. What each write refreshes is {@link settleAutomation}. */
export const automationsKeys = {
  all: ['automations'] as const,
  lists: () => [...automationsKeys.all, 'list'] as const,
  list: () => [...automationsKeys.lists()] as const,
  details: () => [...automationsKeys.all, 'detail'] as const,
  detail: (id: string | undefined) => [...automationsKeys.details(), id] as const,
  runs: () => [...automationsKeys.all, 'runs'] as const,
  runList: (filter: RunsFilter) => [...automationsKeys.runs(), 'list', filter] as const,
  history: (filter: RunHistoryFilter) => [...automationsKeys.runs(), 'history', filter] as const,
  preview: (trigger: GithubTriggerInput | undefined) =>
    [...automationsKeys.all, 'preview', trigger] as const,
};

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
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useQuery<AutomationEntity[], Error, TData>({
    queryKey: automationsKeys.list(),
    queryFn: async () => {
      const askedAt = Date.now();
      const automations = await app.automations.findAll();
      seedDetails(queryClient, automations, automationsKeys.detail, askedAt);
      return automations;
    },
    ...options,
    ...usePollWhile<AutomationEntity[]>(
      'liveRun',
      automationsKeys.list(),
      (rows) => rows?.some((automation) => automation.isRunning) ?? false,
    ),
  });
}

export function useAutomation(
  id: string | undefined,
  options?: Omit<UseQueryOptions<AutomationEntity, Error>, 'queryKey' | 'queryFn' | PollKeys>,
) {
  const app = useConsumerApp();
  return useQuery<AutomationEntity, Error>({
    queryKey: automationsKeys.detail(id),
    queryFn: id ? () => app.automations.findById(id) : skipToken,
    ...options,
    ...usePollWhile<AutomationEntity>(
      'liveRun',
      automationsKeys.detail(id),
      (automation) => automation?.isRunning ?? false,
    ),
  });
}

/**
 * A page of runs under the filters: the Runs tab, and an automation's page.
 * The previous page stays on screen while the next loads, so paging and a
 * status pill never flash the list empty.
 */
export function useAutomationRuns(filter: RunsFilter) {
  const app = useConsumerApp();
  return useQuery<RunPage, Error>({
    queryKey: automationsKeys.runList(filter),
    queryFn: () => app.automations.findRuns(filter),
    placeholderData: keepPreviousData,
    ...usePollWhile<RunPage>(
      'liveRun',
      automationsKeys.runList(filter),
      (page) => page?.items.some((run) => run.isLive) ?? false,
    ),
  });
}

/** The run-history chart: one bar per local day of the viewer's zone. */
export function useRunHistory(filter: RunHistoryFilter) {
  const app = useConsumerApp();
  return useQuery<RunHistory, Error>({
    queryKey: automationsKeys.history(filter),
    queryFn: () => app.automations.history(filter),
    placeholderData: keepPreviousData,
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

export function useCreateAutomation(
  options?: UseMutationOptions<AutomationEntity, Error, AutomationInput>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AutomationInput) => app.automations.create(input),
    ...withCacheOnSuccess(options, (added) => settleAutomation(queryClient, { added })),
  });
}

export interface UpdateAutomationVariables {
  id: string;
  input: UpdateAutomationInput;
}

export function useUpdateAutomation(
  options?: UseMutationOptions<AutomationEntity, Error, UpdateAutomationVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateAutomationVariables) => app.automations.update(id, input),
    ...withCacheOnSuccess(options, (saved) => settleAutomation(queryClient, { saved, runs: true })),
  });
}

export interface PauseAutomationVariables {
  id: string;
  paused: boolean;
}

/** Pause or resume: triggers are ignored while paused, and Run now still works. */
export function useSetAutomationPaused(
  options?: UseMutationOptions<AutomationEntity, Error, PauseAutomationVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paused }: PauseAutomationVariables) =>
      paused ? app.automations.pause(id) : app.automations.resume(id),
    ...withCacheOnSuccess(options, (saved) =>
      settleAutomation(queryClient, { saved, runs: false }),
    ),
  });
}

/** Duplicate: the copy is the caller's, and starts paused only if the original was. */
export function useDuplicateAutomation(
  options?: UseMutationOptions<AutomationEntity, Error, string>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.automations.duplicate(id),
    ...withCacheOnSuccess(options, (added) => settleAutomation(queryClient, { added })),
  });
}

/**
 * Delete: its triggers stop now, and its past runs are kept. The deleted
 * automation's own read is dropped rather than left stale, so nothing asks
 * the API again for a row that is gone.
 */
export function useDeleteAutomation(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.automations.remove(id),
    ...withCacheOnSuccess(options, (_data, removed) => settleAutomation(queryClient, { removed })),
  });
}

export interface RunAutomationVariables {
  id: string;
  /** One per click: a retried request with the same key is the same run. */
  idempotencyKey: string;
}

/** Run now, whether or not the automation is paused. */
export function useRunAutomation(
  options?: UseMutationOptions<AutomationRunEntity, Error, RunAutomationVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: RunAutomationVariables) =>
      app.automations.run(id, idempotencyKey),
    ...withCacheOnSuccess(options, (_run, { id }) => settleAutomation(queryClient, { ran: id })),
  });
}
