import { getRouteApi } from '@tanstack/react-router';
import type { ChatsBy } from '@/features/whatsapp/lib/chat-filter';
import type { ChatTab, WhatsappChatsSearch } from '@/features/whatsapp/lib/chats-search';

const numberRoute = getRouteApi('/_authenticated/settings/whatsapp_/$accountId');

/**
 * The tab, words, answerer and page a number's chats are narrowed to, read
 * from the page's search and written back to it in place: a filter is not a
 * page to go Back to. Narrowing again goes back to the first page.
 */
export function useChatsFilter() {
  const search: WhatsappChatsSearch = numberRoute.useSearch();
  const navigate = numberRoute.useNavigate();
  const write = (patch: WhatsappChatsSearch) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  return {
    filter: {
      tab: search.tab ?? ('group' as ChatTab),
      query: search.q ?? '',
      by: (search.by ?? 'all') as ChatsBy,
      page: search.page ?? 1,
    },
    setTab: (tab: ChatTab) => write({ tab: tab === 'group' ? undefined : tab, page: undefined }),
    setQuery: (query: string) => write({ q: query.trim() ? query : undefined, page: undefined }),
    setBy: (by: ChatsBy) => write({ by: by === 'all' ? undefined : by, page: undefined }),
    setPage: (page: number) => write({ page: page <= 1 ? undefined : page }),
  };
}
