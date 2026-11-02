import { AppError } from '@oppenheimer/backend-core';
import { retryOnVersionConflict, VersionConflictException } from '@oppenheimer/backend-ddd';
import { HostErrors } from '../domain/hosts.errors';

/**
 * How every host command answers losing a write to another one: `attempt`
 * (load, decide, save) runs once more on a fresh read, and losing that try
 * too is `HOSTS_009`. Each attempt must load the host itself, since the copy
 * that lost was decided on a state that no longer exists.
 */
export async function retryHostWrite<T>(hostId: string, attempt: () => Promise<T>): Promise<T> {
  try {
    return await retryOnVersionConflict(attempt);
  } catch (error) {
    if (!(error instanceof VersionConflictException)) throw error;
    throw new AppError(HostErrors.CHANGED_CONCURRENTLY, {
      detail: `Host ${hostId} was written by someone else, again on the retry`,
    });
  }
}
