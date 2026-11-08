import { getRouteApi } from '@tanstack/react-router';
import type { BotPermissionsSearch, ToolView } from '../lib/tool-search';

const ALL: ToolView = 'all';

const permissions = getRouteApi('/_authenticated/bots_/$botId/settings/permissions');

/**
 * The search, decision and group a bot's tools are narrowed to, read from the
 * permissions route's search and written back to it in place: a filter is not
 * a page to go Back to.
 */
export function useToolFilter() {
  const search: BotPermissionsSearch = permissions.useSearch();
  const navigate = permissions.useNavigate();
  const write = (patch: BotPermissionsSearch) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  return {
    filter: {
      query: search.q ?? '',
      view: search.decision ?? ALL,
      group: search.group ?? 'all',
    },
    setQuery: (query: string) => write({ q: query.trim() ? query : undefined }),
    setView: (view: ToolView) => write({ decision: view === 'all' ? undefined : view }),
    setGroup: (group: string) => write({ group: group === 'all' ? undefined : group }),
    clear: () => write({ q: undefined, decision: undefined, group: undefined }),
  };
}
