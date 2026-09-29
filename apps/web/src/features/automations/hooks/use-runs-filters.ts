import type { RunsFilter } from '@oppenheimer/frontend-consumer';
import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';
import type { AutomationRunStatus, RunWindow } from '@oppenheimer/shared/automations';
import { getRouteApi } from '@tanstack/react-router';
import type { RunStatusTab, RunsSearch } from '../lib/runs-search';

/** What each pill asks the API for; `all` is the listed statuses, the API's default. */
const TAB_STATUSES: Record<RunStatusTab, readonly AutomationRunStatus[] | undefined> = {
  all: undefined,
  completed: ['completed'],
  failed: ['failed'],
  running: ['queued', 'running'],
};

const DEFAULT_WINDOW: RunWindow = '30d';

/** Pages of ten, as the foot reads "1–10 of 65". */
export const RUNS_PAGE_SIZE = CONSUMER_CONFIG.automations.runsPageSize;

/** The two routes that draw the list, each declaring `runsSearchSchema`. */
const overview = getRouteApi('/_authenticated/automations/runs');
const automation = getRouteApi('/_authenticated/automations/$automationId');

/**
 * The runs list's facets and page, in the URL (`runsSearchSchema`): a filtered
 * list is a link someone can send, and Back undoes a filter. The search is
 * read from the route that draws the list, as its schema left it. A default
 * is written as no key, so an unfiltered list is a clean URL, and narrowing
 * any facet goes back to page one.
 */
export function useRunsFilters(scope: { automationId?: string }) {
  const route = scope.automationId ? automation : overview;
  const search: RunsSearch = route.useSearch();
  const navigate = route.useNavigate();

  const state = {
    status: search.status ?? 'all',
    automation: search.automation ?? null,
    project: search.project ?? null,
    window: search.window ?? DEFAULT_WINDOW,
    page: search.page ?? 1,
  };

  // The URL's own history entry, replaced: a filter is not a page to go Back to.
  const write = (patch: Partial<RunsSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

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
    state.window !== DEFAULT_WINDOW ||
    (!scope.automationId && (state.automation !== null || state.project !== null));

  return {
    state,
    filter,
    dirty,
    setStatus: (status: RunStatusTab) =>
      write({ status: status === 'all' ? undefined : status, page: undefined }),
    setAutomation: (automation: string | null) =>
      write({ automation: automation ?? undefined, page: undefined }),
    setProject: (project: string | null) =>
      write({ project: project ?? undefined, page: undefined }),
    setWindow: (window: RunWindow) =>
      write({ window: window === DEFAULT_WINDOW ? undefined : window, page: undefined }),
    setPage: (page: number) => write({ page: page === 1 ? undefined : page }),
    clear: () =>
      write({
        status: undefined,
        automation: undefined,
        project: undefined,
        window: undefined,
        page: undefined,
      }),
  };
}
