import { AppError } from '@oppenheimer/backend-core';
import type { UsableHost } from '../../hosts/application/host-access.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * Refuses one more running session on a host that is already at its limit.
 *
 * A check before the write, not a lock: two starts racing for the last slot
 * can both pass, and the host then runs one over. The limit protects a
 * machine from piling up agents, which one extra does not defeat, and a
 * lock across hosts and workspaces would cost every create for that.
 */
export async function requireHostCapacity(
  sessions: Pick<WorkSessionRepositoryPort, 'countRunningByHost'>,
  hostId: string,
  host: Pick<UsableHost, 'sessionLimit'>,
): Promise<void> {
  const limit = host.sessionLimit;
  if (limit === null) return;
  const running = (await sessions.countRunningByHost([hostId])).get(hostId) ?? 0;
  if (running >= limit) {
    throw new AppError(SessionErrors.HOST_AT_CAPACITY, {
      detail: `Host ${hostId} is running ${running} of ${limit} sessions; stop one or raise its limit`,
      extensions: { hostId, running, limit },
    });
  }
}
