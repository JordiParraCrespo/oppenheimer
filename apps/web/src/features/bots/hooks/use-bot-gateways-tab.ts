import { getRouteApi } from '@tanstack/react-router';
import type { BotGatewaysSearch, BotGatewayTab } from '@/features/bots/lib/bot-gateways-search';

const botGatewaysRoute = getRouteApi('/_authenticated/bots_/$botId/settings/gateways');

/**
 * The Gateways tab on screen, read from the page's search and written back in
 * place: a tab is a view of one page, not a page to go Back to.
 */
export function useBotGatewaysTab() {
  const search: BotGatewaysSearch = botGatewaysRoute.useSearch();
  const navigate = botGatewaysRoute.useNavigate();
  return {
    tab: search.tab ?? ('whatsapp' as BotGatewayTab),
    setTab: (tab: BotGatewayTab) =>
      navigate({ search: { tab: tab === 'whatsapp' ? undefined : tab }, replace: true }),
  };
}
