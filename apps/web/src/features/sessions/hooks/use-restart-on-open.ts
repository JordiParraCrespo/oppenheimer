import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import {
  RESTART_WATCH_MS,
  useHostPresence,
  useRestartSession,
} from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef, useState } from 'react';

type RestartOnOpenSession = Pick<
  SessionEntity,
  | 'id'
  | 'hostId'
  | 'isLive'
  | 'isResolved'
  | 'isProvisioning'
  | 'lifecycle'
  | 'cloud'
  | 'isCloud'
  | 'stoppedAt'
>;

/** Where a stopped session's way back stands, for the pane that draws it. */
export type SessionComeback = {
  /** Restart now: the button, and what opening the session did on its own. */
  restart: () => void;
  /** Asked for, and the host has not brought the terminal back yet. */
  restarting: boolean;
  /** The restart failed, or the host never brought the terminal back. */
  failure: unknown;
  /** The host took no answer within the watch: the failure has no error of its own. */
  timedOut: boolean;
};

/**
 * A stopped session comes back when it is opened. The pane that draws a
 * stopped session calls this, so only opening a session does it: hovering its
 * row, prefetching its route or listing it mounts no pane, and so wakes
 * nothing. Only a session that can come back qualifies: stopped (not deleted,
 * starting or failed), on a host of ours that is online right now. A shared
 * viewer's pane is another component and never calls this.
 *
 * Restart records a request; the row stays stopped until the host says the
 * terminal is back, so `restarting` holds until then, and a host that does
 * not answer within the restart watch is a failure, which leaves the stopped
 * pane with Restart and says why.
 */
export function useRestartOnOpen(session: RestartOnOpenSession, auto: boolean): SessionComeback {
  const { mutate, isPending, isSuccess, error } = useRestartSession();
  const { id } = session;
  const stopped =
    !session.isLive &&
    !session.isResolved &&
    !session.isProvisioning &&
    session.lifecycle !== 'failed' &&
    !session.cloud &&
    !session.isCloud &&
    session.hostId !== null;
  // What was opened: a session stopped when its pane mounted. One that
  // stops while the pane is on screen (its agent exited, a stop from the
  // host) stays stopped, as it was left.
  const [stoppedWhenOpened] = useState(stopped);
  const { data: online, isError: hostsUnread } = useHostPresence({
    enabled: auto && stoppedWhenOpened && stopped,
    watching: false,
    select: (hosts) => hosts.find((host) => host.id === session.hostId)?.online ?? false,
  });
  const opened = useRef(false);
  const [timedOut, setTimedOut] = useState(false);
  // The stop the last restart answered, by the host's own stamp: a later one
  // (Stop pressed once the terminal was back) is a stop to show, not a restart.
  const [answered, setAnswered] = useState<number | null>(null);
  const stoppedAt = session.stoppedAt?.getTime() ?? null;
  const sameStop = stoppedAt !== null && stoppedAt === answered;
  const ask = () => {
    setTimedOut(false);
    setAnswered(stoppedAt);
    mutate(id);
  };
  const waiting = isSuccess && !session.isLive && sameStop && !timedOut;
  // About to ask: an open of a session that qualifies reads as restarting
  // from its first frame, not as a Restart button that presses itself.
  const due =
    auto &&
    stoppedWhenOpened &&
    stopped &&
    online !== false &&
    !hostsUnread &&
    !isSuccess &&
    !error;

  // The host is the outside system: an open asks it once to bring the
  // terminal back, the moment it is known to be online.
  useEffect(() => {
    if (!auto || !stoppedWhenOpened || !stopped || online !== true || opened.current) return;
    opened.current = true;
    ask();
  });

  // A timer on the host's answer: one that never comes is a failure.
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setTimedOut(true), RESTART_WATCH_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  return {
    restart: ask,
    restarting: isPending || waiting || due,
    failure: error,
    timedOut,
  };
}
