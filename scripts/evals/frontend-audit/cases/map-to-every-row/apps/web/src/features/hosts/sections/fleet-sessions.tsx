import { SessionList } from '@oppenheimer/design-system-web';
import { useSuspenseSessionsSidebar } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { FleetSessionRow } from '../components/fleet-session-row';

/**
 * Every session in the workspace, each labelled with the host it runs on.
 * Read under Suspense, in the screen's `QueryState`; a refetch that fails
 * keeps the rows and says so above them.
 */
export function FleetSessions() {
  const { t } = useTranslation();
  const { sessions, hosts, error } = useSuspenseSessionsSidebar();
  const hostsById = new Map(hosts.map((host) => [host.id, host]));

  return (
    <>
      <ErrorAlert error={error} fallback={t('sessions.sidebar.loadFailed')} />
      <SessionList>
        {sessions.map((session) => (
          <FleetSessionRow key={session.id} session={session} hostsById={hostsById} />
        ))}
      </SessionList>
    </>
  );
}
