import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { FlagSegmentEntity } from '../domain/flag-segment.entity';

export interface FlagSegmentRepositoryPort extends RepositoryPort<FlagSegmentEntity> {
  findOneByKey(key: string): Promise<Option<FlagSegmentEntity>>;
  /**
   * Every row, in key order. Unbounded on purpose: the set is small (one row
   * per configured flag or segment) and the snapshot resolver holds it whole.
   */
  findAll(): Promise<FlagSegmentEntity[]>;
  /** See `FeatureFlagRepositoryPort.fingerprint`. */
  fingerprint(): Promise<string>;
}
