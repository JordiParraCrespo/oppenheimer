import { SessionItem } from '@oppenheimer/design-system-web';
import type { HostEntity, SessionEntity } from '@oppenheimer/frontend-consumer';

/** One session, with its host's name as the secondary label. */
export function FleetSessionRow({
  session,
  hostsById,
}: {
  session: SessionEntity;
  hostsById: Map<string, HostEntity>;
}) {
  const host = hostsById.get(session.hostId);

  return (
    <SessionItem
      name={session.name}
      age={host?.name}
      state={session.isProvisioning ? 'pending' : 'running'}
    />
  );
}
