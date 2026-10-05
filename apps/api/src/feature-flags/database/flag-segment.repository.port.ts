import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { EntityManager } from 'typeorm';
import type { FlagSegmentEntity } from '../domain/flag-segment.entity';

export interface FlagSegmentRepositoryPort extends RepositoryPort<FlagSegmentEntity> {
  /** With `manager`, reads on that transaction (see `FeatureFlagRepositoryPort.serialized`). */
  findOneByKey(key: string, manager?: EntityManager): Promise<Option<FlagSegmentEntity>>;
  /** See `FeatureFlagRepositoryPort.findAll`. */
  findAll(manager?: EntityManager): Promise<FlagSegmentEntity[]>;
  /** With `manager`, deletes and stages the aggregate's events on that transaction. */
  delete(entity: FlagSegmentEntity, manager?: EntityManager): Promise<boolean>;
  /** See `FeatureFlagRepositoryPort.fingerprint`. */
  fingerprint(): Promise<string>;
}
