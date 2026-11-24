import { createFileRoute } from '@tanstack/react-router';
import { inboxSearchSchema } from '@/features/inbox/lib/inbox-search';
import { InboxScreen } from '@/features/inbox/screens/inbox';

/**
 * The Inbox: what needs you, a page of its own and the rail's first item.
 * The screen is the whole pane, its list column and its deck side by side,
 * and draws its own heads, the sidebar toggle leading the list's. The search
 * names the item on the deck, the list's words (`?q=`) and its facets, which
 * the Inbox's sidebar sets as folders.
 */
export const Route = createFileRoute('/_authenticated/inbox')({
  validateSearch: inboxSearchSchema,
  staticData: { pane: 'full', bar: 'own' },
  component: InboxScreen,
});
