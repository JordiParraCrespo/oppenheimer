import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, TypeOrmRepositoryBase } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { EntityManager, Repository } from 'typeorm';
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

  async findOneByKey(key: string, manager?: EntityManager): Promise<Option<FeatureFlagEntity>> {
    return this.toOption(await this.on(manager).findOneBy({ key }));
  }

  async findAll(manager?: EntityManager): Promise<FeatureFlagEntity[]> {
    const records = await this.on(manager).find({ order: { key: 'ASC' } });
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

  async save(entity: FeatureFlagEntity, manager?: EntityManager): Promise<FeatureFlagEntity> {
    if (!manager) return super.save(entity);
    const record = await manager
      .getRepository(FeatureFlagOrmEntity)
      .save(this.mapper.toPersistence(entity));
    // Events commit or roll back with the caller's transaction. The caller
    // discards the aggregate afterwards, so they are not cleared here.
    await this.outbox.stageEvents(manager, entity.domainEvents);
    return this.mapper.toDomain(record);
  }

  serialized<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    // The lock is transaction-scoped: it is released when the transaction
    // ends, after `work` has committed its writes.
    return this.outbox.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [FLAG_WRITE_LOCK]);
      return work(manager);
    });
  }

  private on(manager?: EntityManager): Repository<FeatureFlagOrmEntity> {
    return manager ? manager.getRepository(FeatureFlagOrmEntity) : this.repository;
  }
}
