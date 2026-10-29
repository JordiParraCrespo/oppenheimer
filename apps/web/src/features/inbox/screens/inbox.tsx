import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { Navigate } from '@tanstack/react-router';
import { useInboxSearch } from '@/features/inbox/hooks/use-inbox-search';
import { useForgetVisitOnLeave } from '@/features/inbox/hooks/use-inbox-visit';
import { InboxListColumn } from '@/features/inbox/sections/inbox-list-column';
import { InboxReader } from '@/features/inbox/sections/inbox-reader';

/**
 * The Inbox (`product/versions/mvp/29-inbox.md`), Plan's first section since
 * the 2026-10-29 frame, laid out as a mail client: the list column and the
 * reading pane side by side in the pane, the list only on a phone until an
 * item is opened. Behind the `inbox` flag: switched off, the address goes on
 * to Plan's board.
 */
export function InboxScreen() {
  const enabled = useFeatureFlag('inbox');
  const { item } = useInboxSearch();
  useForgetVisitOnLeave();

  if (!enabled) return <Navigate to="/plan" replace />;
  return (
    <div className="flex min-h-0 flex-1">
      <InboxListColumn reading={item !== null} />
      <InboxReader reading={item !== null} />
    </div>
  );
}
