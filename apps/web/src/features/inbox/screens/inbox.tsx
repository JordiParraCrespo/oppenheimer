import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { Navigate } from '@tanstack/react-router';
import { useForgetVisitOnLeave } from '@/features/inbox/hooks/use-inbox-visit';
import { InboxBar } from '@/features/inbox/sections/inbox-bar';
import { InboxPane } from '@/features/inbox/sections/inbox-pane';

/**
 * The Inbox (`product/versions/mvp/28-inbox.md`): its bar and its pane; the
 * list is the sidebar's (`InboxSidebar`). Behind the `inbox` flag: switched
 * off, the address goes on to New session, which is where the console
 * landed before the Inbox.
 */
export function InboxScreen() {
  const enabled = useFeatureFlag('inbox');
  useForgetVisitOnLeave();

  if (!enabled) return <Navigate to="/sessions/new" replace />;
  return (
    <>
      <InboxBar />
      <InboxPane />
    </>
  );
}
