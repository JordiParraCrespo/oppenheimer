import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useAcknowledgeSessionReport } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef } from 'react';

/**
 * The open session's finished turn is read: while its pane is drawn and the
 * tab is in front, a session that turns `ready-for-review` (the sidebar's blue
 * dot) is marked read, at once or when the reader comes back to the tab. A
 * turn that ends in a tab nobody is looking at stays blue until they do.
 *
 * One try each time the session's log moves (`lastEventAt`): a failed read
 * is not retried until something new happens to the session, so an API that is down is not asked in a
 * loop for as long as the pane is open.
 */
export function useReadOnOpen(session: Pick<SessionEntity, 'id' | 'state' | 'lastEventAt'>): void {
  const { mutate } = useAcknowledgeSessionReport();
  const tried = useRef<string | null>(null);
  const unread = session.state === 'ready-for-review';
  const key = `${session.id}:${session.lastEventAt?.getTime() ?? 0}`;
  const { id } = session;

  useEffect(() => {
    if (!unread) return;
    const read = () => {
      if (document.visibilityState !== 'visible' || tried.current === key) return;
      tried.current = key;
      mutate(id);
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [id, key, unread, mutate]);
}
