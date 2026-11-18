import { useStoredList } from '@oppenheimer/frontend-web';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { SESSION_UNREAD_KEY, withUnread } from '../lib/session-unread';

export type SessionUnread = {
  marks: readonly string[];
  setUnread: (id: string, unread: boolean) => void;
};

/**
 * The sidebar's unread marks, for the rows: like the pins, the sidebar holds
 * them and a row reads only its own. The value changes only when a mark does.
 */
export const SessionUnreadContext = createContext<SessionUnread>({
  marks: [],
  setUnread: () => {},
});

/** The sessions marked unread, and the mark. localStorage: it outlives the page on this device. */
export function useSessionUnreadMarks(): SessionUnread {
  const [marks, setMarks] = useStoredList(SESSION_UNREAD_KEY);
  return useMemo(
    () => ({
      marks,
      setUnread: (id: string, unread: boolean) =>
        setMarks((current) => withUnread(current, id, unread)),
    }),
    [marks, setMarks],
  );
}

/**
 * One row's mark, taken off when the reader opens its session. Only the
 * opening does: a session marked unread while it is open keeps the mark
 * until the reader leaves it and comes back.
 */
export function useSessionUnread(id: string, active: boolean) {
  const { marks, setUnread } = useContext(SessionUnreadContext);
  const unread = marks.includes(id);
  const wasActive = useRef(active);

  useEffect(() => {
    const opened = active && !wasActive.current;
    wasActive.current = active;
    if (opened && unread) setUnread(id, false);
  }, [active, id, unread, setUnread]);

  return { unread, setUnread: (next: boolean) => setUnread(id, next) };
}
