import { SessionItem } from '@oppenheimer/design-system-web';
import type { HostEntity, SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * One session. A session on a host that has stopped answering reads as
 * needing you, whatever its own state, because nothing on it can move.
 */
export function FleetSessionRow({
  session,
  hostsById,
}: {
  session: SessionEntity;
  hostsById: Map<string, HostEntity>;
}) {
  const host = hostsById.get(session.hostId);
  const state = session.isProvisioning ? 'pending' : host?.online ? 'running' : 'failed';

  return <SessionItem name={session.name} state={state} />;
}
