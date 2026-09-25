import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { FlagSegmentEntity } from '../domain/flag-segment.entity';

/** Port for the segment aggregate. Implemented by `flag-segment.repository.ts`. */
export interface FlagSegmentRepositoryPort extends RepositoryPort<FlagSegmentEntity> {
  findOneByKey(key: string): Promise<Option<FlagSegmentEntity>>;
  /** See `FeatureFlagRepositoryPort.fingerprint`. */
  fingerprint(): Promise<string>;
}
