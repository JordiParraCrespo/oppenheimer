import { createFileRoute } from '@tanstack/react-router';
import { inboxSearchSchema } from '@/features/inbox/lib/inbox-search';
import { InboxScreen } from '@/features/inbox/screens/inbox';

/**
 * The Inbox: what needs you, a page of its own and the rail's first item,
 * with no sidebar: the screen is the rest of the window, its list column and
 * its deck side by side, and draws its own heads. The search names the item
 * on the deck, the list's words (`?q=`) and its facets.
 */
export const Route = createFileRoute('/_authenticated/inbox')({
  validateSearch: inboxSearchSchema,
  staticData: { pane: 'full', bar: 'own', sidebar: 'none' },
  component: InboxScreen,
});
