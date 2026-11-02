import { createFileRoute } from '@tanstack/react-router';
import { inboxSearchSchema } from '@/features/inbox/lib/inbox-search';
import { InboxScreen } from '@/features/inbox/screens/inbox';

/**
 * Plan's Inbox (`product/versions/mvp/29-inbox.md`, the 2026-10-29 frame):
 * what needs you, as a mail client. The screen is the whole pane, its list
 * column and reading pane side by side, and draws its own heads, the sidebar
 * toggle leading the list's. The search names the item in the reading pane,
 * the list's words (`?q=`) and its facets.
 */
export const Route = createFileRoute('/_authenticated/plan/inbox')({
  validateSearch: inboxSearchSchema,
  staticData: { pane: 'full', bar: 'own' },
  component: InboxScreen,
});
