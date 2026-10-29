import type { SessionTerminalWatchEntity } from '../domain/session-terminal-watch.entity';

/**
 * A session's terminal watches. Unscoped by design, as the share's is: the
 * command loads the session through the scoped loader first and passes its
 * ids here, and a hello's reconciliation reads them for a host it already
 * matched to its rows.
 */
export interface SessionTerminalWatchRepositoryPort {
  /** The watch, unless the session already holds `max`: counted under a lock on the session row. */
  insert(watch: SessionTerminalWatchEntity, max: number): Promise<'inserted' | 'full' | 'missing'>;
  /** The watches of these sessions, oldest first. */
  findForSessions(
    organizationId: string,
    sessionIds: readonly string[],
  ): Promise<SessionTerminalWatchEntity[]>;
  findOne(
    organizationId: string,
    sessionId: string,
    watchId: string,
  ): Promise<SessionTerminalWatchEntity | null>;
  /** Removes one; whether there was one to remove. */
  delete(organizationId: string, sessionId: string, watchId: string): Promise<boolean>;
}
