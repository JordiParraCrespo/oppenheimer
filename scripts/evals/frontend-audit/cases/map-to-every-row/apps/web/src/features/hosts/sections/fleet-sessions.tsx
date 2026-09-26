import { SessionList } from '@oppenheimer/design-system-web';
import { useHosts, useSessions } from '@oppenheimer/frontend-consumer/react';
import { FleetSessionRow } from '../components/fleet-session-row';

/** Every session in the workspace, each labelled with the host it runs on. */
export function FleetSessions() {
  const { data: sessions } = useSessions();
  const { data: hosts } = useHosts();
  const hostsById = new Map((hosts ?? []).map((host) => [host.id, host]));

  return (
    <SessionList>
      {(sessions ?? []).map((session) => (
        <FleetSessionRow key={session.id} session={session} hostsById={hostsById} />
      ))}
    </SessionList>
  );
}
