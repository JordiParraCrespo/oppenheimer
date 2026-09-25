import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { FeatureFlagEntity } from '../domain/feature-flag.entity';

/** Port for the flag-targeting aggregate. Implemented by `feature-flag.repository.ts`. */
export interface FeatureFlagRepositoryPort extends RepositoryPort<FeatureFlagEntity> {
  findOneByKey(key: string): Promise<Option<FeatureFlagEntity>>;
  /**
   * A cheap value that changes whenever any row is written or removed. Each
   * replica polls it to decide whether its in-memory snapshot is stale, so it
   * digests every row's content — two writes in the same millisecond, or a
   * rules-only change, still move it — in one query that returns one value.
   */
  fingerprint(): Promise<string>;
}
