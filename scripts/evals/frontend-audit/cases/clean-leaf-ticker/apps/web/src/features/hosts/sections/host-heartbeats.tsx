import { StatusDot } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { LastSeen } from '../components/last-seen';

/** Every host with how long ago it last answered. */
export function HostHeartbeats() {
  const { data: hosts } = useHosts();

  return (
    <ul className="flex flex-col">
      {(hosts ?? []).map((host) => (
        <li key={host.id} className="flex items-center gap-2 py-1.5">
          <StatusDot state={host.online ? 'running' : 'idle'} className="min-w-0 flex-1">
            {host.name}
          </StatusDot>
          <LastSeen since={host.lastSeenAt} />
        </li>
      ))}
    </ul>
  );
}
