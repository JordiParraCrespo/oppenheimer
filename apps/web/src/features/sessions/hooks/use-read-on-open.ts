import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useAcknowledgeSessionReport } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef } from 'react';

type ReadOnOpenSession = Pick<SessionEntity, 'id' | 'state' | 'lastEventAt'>;

/**
 * What one try at reading is for: the session and where its log stands. A
 * failed read is tried again only once this changes or the reader comes back
 * to the tab, so an API that is down is not asked in a loop.
 */
function tryKey(session: ReadOnOpenSession): string | null {
  if (session.state !== 'ready-for-review') return null;
  return `${session.id}:${session.lastEventAt?.getTime() ?? 0}`;
}

/**
 * The open session's finished turn is read: while its pane is drawn and the
 * tab is in front, a session that turns `ready-for-review` (the sidebar's blue
 * dot) is marked read, at once or when the reader comes back to the tab. A
 * turn that ends in a tab nobody is looking at stays blue until they do; a
 * session that sits at its prompt may not move for hours, so coming back to
 * the tab is also what tries a failed read again. With `enabled` false
 * (the session drawn on an Inbox card, which its unread turn is what lists)
 * nothing is read.
 */
export function useReadOnOpen(session: ReadOnOpenSession, enabled = true): void {
  const { mutate } = useAcknowledgeSessionReport();
  const tried = useRef<string | null>(null);
  const key = enabled ? tryKey(session) : null;
  const { id } = session;

  useEffect(() => {
    if (!key) return;
    const read = () => {
      if (document.visibilityState !== 'visible') tried.current = null;
      else if (tried.current !== key) {
        tried.current = key;
        mutate(id);
      }
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [id, key, mutate]);
}
