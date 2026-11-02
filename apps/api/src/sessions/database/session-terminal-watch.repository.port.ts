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
  /**
   * Records the runner's newest count for a watch, never lowering it: reports
   * may arrive out of order. A watch already removed is nothing to record.
   */
  recordMatches(organizationId: string, watchId: string, count: number): Promise<void>;
  /** Removes one; whether there was one to remove. */
  delete(organizationId: string, sessionId: string, watchId: string): Promise<boolean>;
}
