import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import {
  RESTART_WATCH_MS,
  useHostPresence,
  useRestartSession,
} from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef, useState } from 'react';
import {
  asksOnOpen,
  type RestartFacts,
  type RestartRequest,
  type RestartStatus,
  restartStatus,
} from '../lib/restart-status';

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

/** A stopped session's way back, for the pane that draws it. */
export type SessionComeback = {
  status: RestartStatus;
  /** Restart now: the button, and what opening the session does on its own. */
  restart: () => void;
};

/**
 * A stopped session comes back when it is opened. The pane that draws a
 * stopped session calls this with `auto` when it is what the reader
 * navigated to, so only opening a session does it: hovering its row,
 * prefetching its route or listing it mounts no pane, and so wakes nothing.
 * What it asks and what the pane says are `restartStatus`'s; this gathers the
 * facts (the session, its host, the request, the watch) and asks.
 */
export function useRestartOnOpen(session: RestartOnOpenSession, auto: boolean): SessionComeback {
  const { mutate, isPending, isSuccess, error } = useRestartSession();
  const { id } = session;
  const qualifies =
    !session.isLive &&
    !session.isResolved &&
    !session.isProvisioning &&
    session.lifecycle !== 'failed' &&
    !session.cloud &&
    !session.isCloud &&
    session.hostId !== null;
  const [qualifiedWhenOpened] = useState(qualifies);
  const { data: online, isError: hostsUnread } = useHostPresence({
    enabled: auto && qualifiedWhenOpened && qualifies,
    watching: false,
    select: (hosts) => hosts.find((host) => host.id === session.hostId)?.online ?? false,
  });
  const [answered, setAnswered] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const stoppedAt = session.stoppedAt?.getTime() ?? null;
  const request: RestartRequest = isPending
    ? { state: 'pending' }
    : error
      ? { state: 'failed', error }
      : isSuccess
        ? { state: 'sent', answered }
        : { state: 'none' };
  const facts: RestartFacts = {
    auto,
    qualifies,
    qualifiedWhenOpened,
    hostOnline: hostsUnread ? false : online,
    stoppedAt,
    request,
    timedOut,
  };
  const status = restartStatus(facts);
  const ask = () => {
    setTimedOut(false);
    setAnswered(stoppedAt);
    mutate(id);
  };

  // The host is the outside system: an open asks it once to bring the
  // terminal back, the moment it is known to be online.
  const asked = useRef(false);
  const due = asksOnOpen(facts);
  useEffect(() => {
    if (!due || asked.current) return;
    asked.current = true;
    ask();
  });

  // A timer on the host's answer: one that never comes is a failure.
  const waiting = request.state === 'sent' && status.kind === 'restarting';
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setTimedOut(true), RESTART_WATCH_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  return { status, restart: ask };
}
