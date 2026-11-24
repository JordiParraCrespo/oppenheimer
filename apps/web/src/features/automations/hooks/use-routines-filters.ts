import { getRouteApi } from '@tanstack/react-router';
import type {
  RoutineStatusTab,
  RoutinesFilterState,
  RoutinesSearch,
  RoutineTriggerSource,
} from '../lib/routines-search';

const route = getRouteApi('/_authenticated/automations/routines');

/**
 * The Bot routines tab's filters, read from its route as `routinesSearchSchema`
 * left them. A default is written as no key, so an unfiltered list is a clean
 * URL; each change replaces the history entry, since a filter is not a page
 * to go Back to.
 */
export function useRoutinesFilters() {
  const search: RoutinesSearch = route.useSearch();
  const navigate = route.useNavigate();

  const state: RoutinesFilterState = {
    status: search.status ?? 'all',
    bot: search.bot ?? null,
    trigger: search.trigger ?? null,
  };

  const write = (patch: Partial<RoutinesSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  return {
    state,
    dirty: state.status !== 'all' || state.bot !== null || state.trigger !== null,
    setStatus: (status: RoutineStatusTab) =>
      write({ status: status === 'all' ? undefined : status }),
    setBot: (bot: string | null) => write({ bot: bot ?? undefined }),
    setTrigger: (trigger: RoutineTriggerSource | null) => write({ trigger: trigger ?? undefined }),
    clear: () => write({ status: undefined, bot: undefined, trigger: undefined }),
  };
}
