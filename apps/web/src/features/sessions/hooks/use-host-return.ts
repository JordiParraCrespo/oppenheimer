import type { StreamStatus } from '@oppenheimer/frontend-consumer';
import { type HostReach, useHostReach } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef } from 'react';

/**
 * The session's host, watched while the terminal says it is offline, and a
 * redial the moment it comes back.
 *
 * The stream's own ladder would find the host again too, but its last rung is
 * thirty seconds, and a reader who has just restarted the runner should not
 * wait that out. Only a change from offline to online dials: a host the list
 * still calls online while the relay says otherwise is a stale read, and
 * dialling on every poll would reset the ladder to its first rung forever.
 */
export function useHostReturn(
  hostId: string,
  status: StreamStatus,
  redial: () => void,
): HostReach | undefined {
  const reach = useHostReach(hostId, status === 'offline');
  const online = reach?.online;
  const wasOnline = useRef(online);
  const redialRef = useRef(redial);
  useEffect(() => {
    redialRef.current = redial;
  });

  useEffect(() => {
    const before = wasOnline.current;
    wasOnline.current = online;
    if (status === 'offline' && before === false && online === true) redialRef.current();
  }, [online, status]);

  return reach;
}
