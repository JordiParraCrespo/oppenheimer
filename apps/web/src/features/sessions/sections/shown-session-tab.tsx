import { ChatTabSkeleton } from '@oppenheimer/design-system-web';
import { useSession } from '@oppenheimer/frontend-consumer/react';
import { SessionOpenTab } from './session-open-tab';

/**
 * The tab of the session on screen, drawn from the session itself rather
 * than the list: a session the list leaves out (deleted, opened from an old
 * link; just created; the list still loading or failed) keeps its tab, with
 * its name and its state, while the page shows it.
 */
export function ShownSessionTab({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { data: session, isPending } = useSession(sessionId);
  if (session) return <SessionOpenTab session={session} active onClose={onClose} />;
  return isPending ? <ChatTabSkeleton active /> : null;
}
