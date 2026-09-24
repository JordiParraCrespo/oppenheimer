import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AggregateID,
  OutboxService,
  Paginated,
  type PaginatedQueryParams,
} from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type Repository } from 'typeorm';
import type { FeatureFlagEntity } from '../domain/feature-flag.entity';
import { FeatureFlagMapper } from '../feature-flag.mapper';
import { FeatureFlagOrmEntity } from './feature-flag.orm-entity';
import type { FeatureFlagRepositoryPort } from './feature-flag.repository.port';

/**
 * TypeORM adapter for flag targeting. Stages the aggregate's change events on
 * the transactional outbox with the write, so an audited change and the change
 * itself commit together.
 */
@Injectable()
export class FeatureFlagRepository implements FeatureFlagRepositoryPort {
  constructor(
    @InjectRepository(FeatureFlagOrmEntity)
    private readonly repository: Repository<FeatureFlagOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: FeatureFlagMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insert(entity: FeatureFlagEntity | FeatureFlagEntity[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const records = entities.map((e) => this.mapper.toPersistence(e));
    await this.outbox.writeWithEvents(entities, (manager) => {
      const repository = manager.getRepository(FeatureFlagOrmEntity);
      // `QueryDeepPartialEntity` cannot represent the jsonb unions; see RoleRepository.
      return repository.insert(records as Parameters<typeof repository.insert>[0]);
    });
  }

  async save(entity: FeatureFlagEntity): Promise<FeatureFlagEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(FeatureFlagOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findOneById(id: string): Promise<Option<FeatureFlagEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByKey(key: string): Promise<Option<FeatureFlagEntity>> {
    const record = await this.repository.findOneBy({ key });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findAll(): Promise<FeatureFlagEntity[]> {
    const records = await this.repository.find({ order: { key: 'ASC' } });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAllPaginated(params: PaginatedQueryParams): Promise<Paginated<FeatureFlagEntity>> {
    const [records, count] = await this.repository.findAndCount({
      skip: params.offset,
      take: params.limit,
      order: { key: params.orderBy.param === 'desc' ? 'DESC' : 'ASC' },
    });
    return new Paginated({
      count,
      limit: params.limit,
      page: params.page,
      data: records.map((record) => this.mapper.toDomain(record)),
    });
  }

  async fingerprint(): Promise<string> {
    // Every column of every row, in key order — the jsonb rules and the full
    // microsecond timestamp included — so no change can leave it standing still.
    const [row] = await this.repository.query(
      `SELECT count(*)::text || ':' || coalesce(md5(string_agg(to_jsonb(t)::text, ',' ORDER BY t.key)), '') AS digest FROM feature_flag t`,
    );
    return (row as { digest: string } | undefined)?.digest ?? '';
  }

  async delete(entity: FeatureFlagEntity): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(FeatureFlagOrmEntity).delete({ id: entity.id as AggregateID }),
    );
    return result.affected ? result.affected > 0 : false;
  }

  transaction<T>(handler: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(() => handler());
  }
}
