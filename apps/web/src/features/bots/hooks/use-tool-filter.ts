import { getRouteApi } from '@tanstack/react-router';
import type { BotPermissionsSearch, ToolView } from '../lib/tool-filter';

const permissions = getRouteApi('/_authenticated/bots_/$botId/settings/permissions');

/**
 * The search over a bot's tools and its view (all, one decision, the ones you
 * set), read from the permissions route's search and written back to it in
 * place: a filter is not a page to go Back to.
 */
export function useToolFilter() {
  const search: BotPermissionsSearch = permissions.useSearch();
  const navigate = permissions.useNavigate();
  const write = (patch: BotPermissionsSearch) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  return {
    query: search.q ?? '',
    view: search.tools ?? ('all' as ToolView),
    setQuery: (query: string) => write({ q: query.trim() ? query : undefined }),
    setView: (view: ToolView) => write({ tools: view === 'all' ? undefined : view }),
  };
}
