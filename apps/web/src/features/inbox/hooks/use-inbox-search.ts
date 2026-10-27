import { getRouteApi } from '@tanstack/react-router';
import type { InboxFilter } from '../lib/inbox-filter';
import type { InboxSearch, InboxTypeFilter } from '../lib/inbox-search';

const route = getRouteApi('/_authenticated/inbox');

/**
 * The Inbox's search, as `inboxSearchSchema` left it: the item in the pane
 * and the list's facets. A default is no key, and a facet replaces the
 * history entry: a filter is not a page to go Back to.
 */
export function useInboxSearch() {
  const search: InboxSearch = route.useSearch();
  const navigate = route.useNavigate();
  const write = (patch: Partial<InboxSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const filter: InboxFilter = { type: search.type ?? 'all', project: search.project ?? null };
  return {
    item: search.item ?? null,
    filter,
    showDone: !search.hideDone,
    dirty: filter.type !== 'all' || filter.project !== null || Boolean(search.hideDone),
    /** Names the item in the pane; null leaves it to the first. Pushed, so Back returns to the last one. */
    setItem: (item: string | null) =>
      navigate({ search: (previous) => ({ ...previous, item: item ?? undefined }) }),
    setType: (type: InboxTypeFilter) => write({ type: type === 'all' ? undefined : type }),
    setProject: (project: string | null) => write({ project: project ?? undefined }),
    setShowDone: (show: boolean) => write({ hideDone: show ? undefined : true }),
    clear: () => write({ type: undefined, project: undefined, hideDone: undefined }),
  };
}
