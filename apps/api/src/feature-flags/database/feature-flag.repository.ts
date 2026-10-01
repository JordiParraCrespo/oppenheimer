import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, TypeOrmRepositoryBase } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { Repository } from 'typeorm';
import type { FeatureFlagEntity } from '../domain/feature-flag.entity';
import { FeatureFlagMapper } from '../feature-flag.mapper';
import { FeatureFlagOrmEntity } from './feature-flag.orm-entity';
import type { FeatureFlagRepositoryPort } from './feature-flag.repository.port';

/** The advisory lock every flag and segment write holds: `'flag'` as a bigint. */
const FLAG_WRITE_LOCK = 0x666c6167;

@Injectable()
export class FeatureFlagRepository
  extends TypeOrmRepositoryBase<FeatureFlagEntity, FeatureFlagOrmEntity>
  implements FeatureFlagRepositoryPort
{
  constructor(
    @InjectRepository(FeatureFlagOrmEntity)
    protected readonly repository: Repository<FeatureFlagOrmEntity>,
    protected readonly mapper: FeatureFlagMapper,
    protected readonly outbox: OutboxService,
  ) {
    super();
  }

  /** The writes this replica has queued, so each holds one connection at a time. */
  private queue: Promise<unknown> = Promise.resolve();

  async findOneByKey(key: string): Promise<Option<FeatureFlagEntity>> {
    return this.toOption(await this.repository.findOneBy({ key }));
  }

  async findAll(): Promise<FeatureFlagEntity[]> {
    const records = await this.repository.find({ order: { key: 'ASC' } });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async fingerprint(): Promise<string> {
    // Every column of every row, in key order — the jsonb rules and the full
    // microsecond timestamp included — so no change can leave it standing still.
    const [row] = await this.repository.query(
      `SELECT count(*)::text || ':' || coalesce(md5(string_agg(to_jsonb(t)::text, ',' ORDER BY t.key)), '') AS digest FROM feature_flag t`,
    );
    return (row as { digest: string } | undefined)?.digest ?? '';
  }

  serialized<T>(work: () => Promise<T>): Promise<T> {
    // Queued here first: a write waiting on the lock holds a pooled
    // connection, and the one holding it needs another for its own queries,
    // so replica-wide waiters could otherwise starve the pool. The lock is
    // transaction-scoped: it is released when the transaction ends, after
    // `work` has committed its writes.
    const run = this.queue.then(() =>
      this.repository.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock($1)', [FLAG_WRITE_LOCK]);
        return work();
      }),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }
}
