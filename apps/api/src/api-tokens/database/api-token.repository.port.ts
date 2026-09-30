import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { ApiTokenEntity } from '../domain/api-token.entity';

export interface ApiTokenRepositoryPort extends RepositoryPort<ApiTokenEntity> {
  /** Look a token up by the SHA-256 digest of the presented secret. */
  findOneByHash(tokenHash: string): Promise<Option<ApiTokenEntity>>;

  /** Every token belonging to a user, newest first, including revoked ones. */
  findByUserId(userId: string): Promise<ApiTokenEntity[]>;

  /** How many of a user's tokens are still usable (not revoked, not expired). */
  countActiveForUser(userId: string, now: Date): Promise<number>;

  /**
   * Record a successful authentication without loading and saving the whole
   * aggregate, and without touching `updatedAt`. `lastUsedAt` has a minute's
   * granularity (`LAST_USED_GRANULARITY_MS`): a stamp less than that after the
   * stored one is a no-op, decided in the `WHERE`, so concurrent callers and
   * replicas write it at most once a minute.
   */
  touchLastUsedAt(id: string, at: Date): Promise<void>;
}
