import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { EntityManager } from 'typeorm';
import type { FeatureFlagEntity } from '../domain/feature-flag.entity';

/** The transaction `serialized` hands its work: an `EntityManager`, named here so callers outside the adapters need not import TypeORM. */
export type FlagTransaction = EntityManager;

export interface FeatureFlagRepositoryPort extends RepositoryPort<FeatureFlagEntity> {
  /** With `manager`, reads on that transaction (see `serialized`). */
  findOneByKey(key: string, manager?: EntityManager): Promise<Option<FeatureFlagEntity>>;
  /**
   * Every row, in key order. Unbounded on purpose: the set is small (one row
   * per configured flag or segment) and the snapshot resolver holds it whole.
   */
  findAll(manager?: EntityManager): Promise<FeatureFlagEntity[]>;
  /** With `manager`, writes and stages the aggregate's events on that transaction. */
  save(entity: FeatureFlagEntity, manager?: EntityManager): Promise<FeatureFlagEntity>;
  /**
   * A cheap value that changes whenever any row is written or removed. Each
   * replica polls it to decide whether its in-memory snapshot is stale, so it
   * digests every row's content — two writes in the same millisecond, or a
   * rules-only change, still move it — in one query that returns one value.
   */
  fingerprint(): Promise<string>;
  /**
   * Run `work` in one transaction that holds the flag write lock, so no other
   * flag or segment write runs meanwhile, on this replica or any other. `work`
   * receives the transaction's manager and does every read it depends on and
   * every write through it (the `manager` argument of the flag and segment
   * repositories): what it checked cannot change before it commits, and it
   * needs no connection beyond the one the transaction holds.
   */
  serialized<T>(work: (manager: EntityManager) => Promise<T>): Promise<T>;
}
