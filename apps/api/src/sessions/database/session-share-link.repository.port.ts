import type { Option } from 'oxide.ts';
import type { SessionShareLinkEntity } from '../domain/session-share-link.entity';

/**
 * The links of a session. Unscoped by design: the owner's slices load the
 * session through the scoped loader first and pass its ids here, and a
 * holder's lookup is by the secret's digest, which is the authorization.
 */
export interface SessionShareLinkRepositoryPort {
  /** Inserts unless the session already holds `limit` live links. */
  insertWithinLimit(
    link: SessionShareLinkEntity,
    limit: number,
    now: Date,
  ): Promise<'inserted' | 'limit_reached'>;
  save(link: SessionShareLinkEntity): Promise<void>;
  findOneByTokenHash(tokenHash: string): Promise<Option<SessionShareLinkEntity>>;
  findOneById(id: string): Promise<Option<SessionShareLinkEntity>>;
  /** Every link of the session, live or not, newest first. */
  findBySession(organizationId: string, sessionId: string): Promise<SessionShareLinkEntity[]>;
}
