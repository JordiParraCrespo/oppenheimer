import { StatusDot } from '@oppenheimer/design-system-web';
import { useSuspenseHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { LastSeen } from '../components/last-seen';

/**
 * Every host with how long ago it last answered. Read under Suspense, in the
 * screen's `QueryState`; a refetch that fails keeps the rows and says so.
 */
export function HostHeartbeats() {
  const { t } = useTranslation();
  const { data: hosts, error } = useSuspenseHosts();

  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.hosts.failed')} />
      <ul className="flex flex-col">
        {hosts.map((host) => (
          <li key={host.id} className="flex items-center gap-2 py-1.5">
            <StatusDot state={host.online ? 'running' : 'idle'} className="min-w-0 flex-1">
              {host.name}
            </StatusDot>
            {host.lastSeenAt ? <LastSeen since={host.lastSeenAt} /> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
