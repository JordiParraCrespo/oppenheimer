import { getRouteApi } from '@tanstack/react-router';
import type {
  ModelProvidersSearch,
  ModelProviderTab,
} from '@/features/bots/lib/model-providers-search';

const modelProvidersRoute = getRouteApi('/_authenticated/settings/model-providers');

/**
 * The Model providers tab on screen, read from the page's search and written
 * back in place: a tab is a view of one page, not a page to go Back to.
 */
export function useModelProvidersTab() {
  const search: ModelProvidersSearch = modelProvidersRoute.useSearch();
  const navigate = modelProvidersRoute.useNavigate();
  return {
    tab: search.tab ?? ('providers' as ModelProviderTab),
    setTab: (tab: ModelProviderTab) =>
      navigate({ search: { tab: tab === 'providers' ? undefined : tab }, replace: true }),
  };
}
