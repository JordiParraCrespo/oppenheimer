'use client';

import { shareEntities, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  keepPreviousData,
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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

/**
 * Query key factory for the `automations` feature. Runs sit under the same
 * root because every automation write can change them: a delete marks its
 * runs as the deleted automation's, Run now adds one, a pause changes what
 * the next slot does.
 */
export const automationsKeys = {
  all: ['automations'] as const,
  lists: () => [...automationsKeys.all, 'list'] as const,
  list: () => [...automationsKeys.lists()] as const,
  details: () => [...automationsKeys.all, 'detail'] as const,
  detail: (id: string | undefined) => [...automationsKeys.details(), id] as const,
  runs: () => [...automationsKeys.all, 'runs'] as const,
  runList: (filter: RunsFilter) => [...automationsKeys.runs(), 'list', filter] as const,
  run: (id: string | undefined) => [...automationsKeys.runs(), 'detail', id] as const,
  history: (filter: RunHistoryFilter) => [...automationsKeys.runs(), 'history', filter] as const,
  preview: (trigger: GithubTriggerInput | undefined) =>
    [...automationsKeys.all, 'preview', trigger] as const,
};

type GithubTriggerInput = Extract<TriggerInput, { source: 'github' }>;

/**
 * How often a view holding a live run asks again.
 *
 * A run's status is its session's first turn, and nothing pushes that to the
 * console yet; a run is queued for seconds and runs for minutes, so a view
 * that shows one polls until it shows none. When session events are streamed
 * to the console this goes, with the sessions poll it copies.
 */
const LIVE_RUN_POLL_MS = 5000;

/**
 * The workspace's automations, oldest first: the sidebar's groups and the
 * overview's table read the same list. Each carries its status, its next run
 * and its last six runs, so neither needs a second request.
 */
export function useAutomations<TData = AutomationEntity[]>(
  options?: Omit<UseQueryOptions<AutomationEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<AutomationEntity[], Error, TData>({
    queryKey: automationsKeys.list(),
    queryFn: () => app.automations.findAll(),
    structuralSharing: shareEntities,
    refetchInterval: (query) =>
      query.state.data?.some((automation) => automation.isRunning) ? LIVE_RUN_POLL_MS : false,
    ...options,
  });
}

/** One automation, for its page. */
export function useAutomation(
  id: string | undefined,
  options?: Omit<UseQueryOptions<AutomationEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<AutomationEntity, Error>({
    queryKey: automationsKeys.detail(id),
    queryFn: id ? () => app.automations.findById(id) : skipToken,
    structuralSharing: shareEntities,
    refetchInterval: (query) => (query.state.data?.isRunning ? LIVE_RUN_POLL_MS : false),
    ...options,
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
    refetchInterval: (query) =>
      query.state.data?.items.some((run) => run.isLive) ? LIVE_RUN_POLL_MS : false,
  });
}

/** One run. */
export function useAutomationRun(id: string | undefined) {
  const app = useConsumerApp();
  return useQuery<AutomationRunEntity, Error>({
    queryKey: automationsKeys.run(id),
    queryFn: id ? () => app.automations.findRun(id) : skipToken,
    structuralSharing: shareEntities,
    refetchInterval: (query) => (query.state.data?.isLive ? LIVE_RUN_POLL_MS : false),
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
    staleTime: 30_000,
  });
}

function useInvalidateAutomations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: automationsKeys.all });
}

export function useCreateAutomation(
  options?: UseMutationOptions<AutomationEntity, Error, AutomationInput>,
) {
  const app = useConsumerApp();
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (input: AutomationInput) => app.automations.create(input),
    ...withCacheOnSuccess(options, invalidate),
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
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: ({ id, input }: UpdateAutomationVariables) => app.automations.update(id, input),
    ...withCacheOnSuccess(options, invalidate),
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
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: ({ id, paused }: PauseAutomationVariables) =>
      paused ? app.automations.pause(id) : app.automations.resume(id),
    ...withCacheOnSuccess(options, invalidate),
  });
}

/** Duplicate: the copy is the caller's, and starts paused only if the original was. */
export function useDuplicateAutomation(
  options?: UseMutationOptions<AutomationEntity, Error, string>,
) {
  const app = useConsumerApp();
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (id: string) => app.automations.duplicate(id),
    ...withCacheOnSuccess(options, invalidate),
  });
}

/** Delete: its triggers stop now, and its past runs are kept. */
export function useDeleteAutomation(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (id: string) => app.automations.remove(id),
    ...withCacheOnSuccess(options, invalidate),
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
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: RunAutomationVariables) =>
      app.automations.run(id, idempotencyKey),
    ...withCacheOnSuccess(options, invalidate),
  });
}
