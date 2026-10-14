import type { Option } from 'oxide.ts';
import type { SessionShareEntity } from '../domain/session-share.entity';

/**
 * The share of a session. Unscoped by design: the owner's slices load the
 * session through the scoped loader first and pass its ids here, and a
 * guest's lookup is by the address, which the share then judges against
 * who is signed in.
 */
export interface SessionShareRepositoryPort {
  /**
   * Writes the share. A session holds one, so a share made while another
   * request made one first becomes an update of that one, keeping its
   * address; the answer is the row as stored.
   */
  upsert(share: SessionShareEntity): Promise<SessionShareEntity>;
  findOneBySession(organizationId: string, sessionId: string): Promise<Option<SessionShareEntity>>;
  findOneBySlug(slug: string): Promise<Option<SessionShareEntity>>;
  findOneById(id: string): Promise<Option<SessionShareEntity>>;
  delete(share: SessionShareEntity): Promise<void>;
}
