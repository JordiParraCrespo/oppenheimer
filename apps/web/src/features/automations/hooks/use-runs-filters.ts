import type { RunsFilter } from '@oppenheimer/frontend-consumer';
import { type AutomationRunStatus, RUN_WINDOWS } from '@oppenheimer/shared/automations';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

/** The Runs tab's status pills, in the frames' order. */
export const RUN_STATUS_TABS = ['all', 'completed', 'failed', 'running'] as const;
export type RunStatusTab = (typeof RUN_STATUS_TABS)[number];

/** What each pill asks the API for; `all` is the listed statuses, the API's default. */
const TAB_STATUSES: Record<RunStatusTab, readonly AutomationRunStatus[] | undefined> = {
  all: undefined,
  completed: ['completed'],
  failed: ['failed'],
  running: ['queued', 'running'],
};

const PARSERS = {
  status: parseAsStringLiteral(RUN_STATUS_TABS).withDefault('all'),
  automation: parseAsString,
  project: parseAsString,
  window: parseAsStringLiteral(RUN_WINDOWS).withDefault('30d'),
  page: parseAsInteger.withDefault(1),
};

/** Pages of ten, as the foot reads "1–10 of 65". */
export const RUNS_PAGE_SIZE = 10;

/**
 * The runs list's facets and page, in the URL (`.agents/rules/frontend-ui.md`):
 * a filtered list is a link someone can send, and Back undoes a filter.
 * Narrowing any facet goes back to page one.
 */
export function useRunsFilters(scope: { automationId?: string }) {
  const [state, setState] = useQueryStates(PARSERS, { history: 'replace' });

  const filter: RunsFilter = {
    automationId: scope.automationId ?? state.automation ?? undefined,
    projectId: scope.automationId ? undefined : (state.project ?? undefined),
    statuses: TAB_STATUSES[state.status],
    window: state.window,
    page: state.page,
    limit: RUNS_PAGE_SIZE,
  };

  const dirty =
    state.status !== 'all' ||
    state.window !== '30d' ||
    (!scope.automationId && (state.automation !== null || state.project !== null));

  return {
    state,
    filter,
    dirty,
    setStatus: (status: RunStatusTab) => setState({ status, page: 1 }),
    setAutomation: (automation: string | null) => setState({ automation, page: 1 }),
    setProject: (project: string | null) => setState({ project, page: 1 }),
    setWindow: (window: (typeof RUN_WINDOWS)[number]) => setState({ window, page: 1 }),
    setPage: (page: number) => setState({ page }),
    clear: () =>
      setState({ status: null, automation: null, project: null, window: null, page: null }),
  };
}
