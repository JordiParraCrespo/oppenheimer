import type { Option } from 'oxide.ts';
import type { SessionRecord } from '../profile.mapper';

/** A session row plus the bearer token that revoking it needs. */
export interface OwnedSession extends SessionRecord {
  userId: string;
  token: string;
}

/**
 * Read port over Better Auth's `session` table.
 *
 * Better Auth owns the table and every write to it — this module only reads,
 * so the port is deliberately not a `RepositoryPort`: sessions are not an
 * aggregate of the profile module, and pretending otherwise would invite
 * someone to persist one from here.
 */
export interface SessionReaderPort {
  /**
   * A user's live **device** sessions, newest last-seen first. Expired rows are
   * excluded, and so are the delegated ones an API token or OAuth client is
   * bridged through — those are not devices anybody signed in on.
   */
  findActiveByUserId(userId: string): Promise<OwnedSession[]>;
  /** One device session by id. A delegated row reads as absent, as above. */
  findOneById(sessionId: string): Promise<Option<OwnedSession>>;
}
