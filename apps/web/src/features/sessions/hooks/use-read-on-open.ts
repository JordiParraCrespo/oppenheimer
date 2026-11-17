import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useAcknowledgeSessionReport } from '@oppenheimer/frontend-consumer/react';
import { useEffect } from 'react';

/**
 * The open session's finished turn is read: while its pane is drawn and the
 * tab is in front, a session that turns `ready-for-review` (the sidebar's blue
 * dot) is marked read, at once or when the reader comes back to the tab. A
 * turn that ends in a tab nobody is looking at stays blue until they do.
 */
export function useReadOnOpen(session: Pick<SessionEntity, 'id' | 'state'>): void {
  const { mutate, isPending } = useAcknowledgeSessionReport();
  const unread = session.state === 'ready-for-review';
  const { id } = session;

  useEffect(() => {
    if (!unread || isPending) return;
    const read = () => {
      if (document.visibilityState === 'visible') mutate(id);
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [id, unread, isPending, mutate]);
}
