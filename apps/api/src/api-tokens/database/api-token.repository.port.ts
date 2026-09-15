import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { ApiTokenEntity } from '../domain/api-token.entity';

/**
 * Port for persisting and querying the API token aggregate. Implemented by the
 * TypeORM adapter in `api-token.repository.ts`.
 */
export interface ApiTokenRepositoryPort extends RepositoryPort<ApiTokenEntity> {
  /** Look a token up by the SHA-256 digest of the presented secret. */
  findOneByHash(tokenHash: string): Promise<Option<ApiTokenEntity>>;

  /** Every token belonging to a user, newest first, including revoked ones. */
  findByUserId(userId: string): Promise<ApiTokenEntity[]>;

  /** How many of a user's tokens are still usable (not revoked, not expired). */
  countActiveForUser(userId: string, now: Date): Promise<number>;

  /**
   * Record a successful authentication without loading and saving the whole
   * aggregate — this runs on every request, so it stays a single UPDATE.
   */
  touchLastUsedAt(id: string, at: Date): Promise<void>;
}
