import { getRouteApi } from '@tanstack/react-router';
import type { BotPermissionsSearch, ToolView } from '../lib/tool-filter';

const permissions = getRouteApi('/_authenticated/bots_/$botId/settings/permissions');

/**
 * The view of a bot's tools (all, one decision, the ones you set), read from
 * the permissions route's search and written back to it in place: a filter is
 * not a page to go Back to.
 */
export function useToolView(): { view: ToolView; setView: (view: ToolView) => void } {
  const search: BotPermissionsSearch = permissions.useSearch();
  const navigate = permissions.useNavigate();

  return {
    view: search.tools ?? 'all',
    setView: (view) =>
      navigate({
        search: (previous) => ({ ...previous, tools: view === 'all' ? undefined : view }),
        replace: true,
      }),
  };
}
