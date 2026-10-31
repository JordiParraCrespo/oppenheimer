'use client';

import type {
  RunHistoryFilter,
  RunsFilter,
  TriggerInput,
} from '../modules/automations/automation.entity';

type GithubTriggerInput = Extract<TriggerInput, { source: 'github' }>;

/**
 * Query key factory for the `automations` feature. What each write refreshes
 * is `settleAutomation` in `automations.queries.ts`.
 */
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
