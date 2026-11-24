import { getRouteApi } from '@tanstack/react-router';
import type { AutomationsSearch } from '../lib/automations-search';
import type { ListFilterState, StatusTab, TriggerSource } from '../lib/list-filters';

const route = getRouteApi('/_authenticated/automations/');

/**
 * The Automations tab's filters, read from its route as
 * `automationsSearchSchema` left them; the project is the list's owner facet.
 * A default is written as no key, so an unfiltered list is a clean URL; each
 * change replaces the history entry, since a filter is not a page to go Back to.
 */
export function useAutomationsFilters() {
  const search: AutomationsSearch = route.useSearch();
  const navigate = route.useNavigate();

  const state: ListFilterState = {
    status: search.status ?? 'all',
    owner: search.project ?? null,
    trigger: search.trigger ?? null,
  };

  const write = (patch: Partial<AutomationsSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  return {
    state,
    dirty: state.status !== 'all' || state.owner !== null || state.trigger !== null,
    setStatus: (status: StatusTab) => write({ status: status === 'all' ? undefined : status }),
    setProject: (project: string | null) => write({ project: project ?? undefined }),
    setTrigger: (trigger: TriggerSource | null) => write({ trigger: trigger ?? undefined }),
    clear: () => write({ status: undefined, project: undefined, trigger: undefined }),
  };
}
