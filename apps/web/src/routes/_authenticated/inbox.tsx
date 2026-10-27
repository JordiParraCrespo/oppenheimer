import { createFileRoute } from '@tanstack/react-router';
import { inboxSearchSchema } from '@/features/inbox/lib/inbox-search';
import { InboxScreen } from '@/features/inbox/screens/inbox';

/**
 * `/inbox` (`product/versions/mvp/29-inbox.md`): what needs you, one thing at
 * a time. The list is the console's sidebar on this address
 * (`useConsoleList`); the pane is a page at the `narrow` measure under a bar
 * of its own, the Inbox's name and counts. The search names the item in the
 * pane and the list's facets.
 */
export const Route = createFileRoute('/_authenticated/inbox')({
  validateSearch: inboxSearchSchema,
  staticData: { pane: 'narrow', bar: 'own' },
  component: InboxScreen,
});
