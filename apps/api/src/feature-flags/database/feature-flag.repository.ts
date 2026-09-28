import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, TypeOrmRepositoryBase } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { Repository } from 'typeorm';
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
}
