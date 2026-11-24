import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ListFilters, StatusTab, TriggerSource } from '../lib/list-filters';

/** The URL key of each list's owner facet, as its route's search schema names it. */
const OWNER_KEY = { automations: 'project', routines: 'bot' } as const;

interface ListSearch {
  status?: StatusTab;
  trigger?: TriggerSource;
  project?: string;
  bot?: string;
}

/**
 * The filters of the Automations or Bot routines tab, read from the route that
 * draws the list, as its search schema (`automationsSearchSchema`,
 * `routinesSearchSchema`) left them. The two differ only in the owner facet's
 * key. A default is written as no key, so an unfiltered list is a clean URL;
 * each change replaces the history entry, since a filter is not a page to go
 * Back to.
 */
export function useListFilters(list: keyof typeof OWNER_KEY): ListFilters {
  const ownerKey = OWNER_KEY[list];
  const search: ListSearch = useSearch({ strict: false });
  const navigate = useNavigate();

  const state = {
    status: search.status ?? 'all',
    owner: search[ownerKey] ?? null,
    trigger: search.trigger ?? null,
  };

  const write = (patch: ListSearch) =>
    navigate({
      to: '.',
      search: (previous: ListSearch) => ({ ...previous, ...patch }),
      replace: true,
    });

  return {
    state,
    dirty: state.status !== 'all' || state.owner !== null || state.trigger !== null,
    setStatus: (status) => write({ status: status === 'all' ? undefined : status }),
    setOwner: (owner) => write({ [ownerKey]: owner ?? undefined }),
    setTrigger: (trigger) => write({ trigger: trigger ?? undefined }),
    clear: () => write({ status: undefined, [ownerKey]: undefined, trigger: undefined }),
  };
}
