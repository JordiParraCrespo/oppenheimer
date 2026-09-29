import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, TypeOrmRepositoryBase } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { Repository } from 'typeorm';
import type { FlagSegmentEntity } from '../domain/flag-segment.entity';
import { FlagSegmentMapper } from '../flag-segment.mapper';
import { FlagSegmentOrmEntity } from './flag-segment.orm-entity';
import type { FlagSegmentRepositoryPort } from './flag-segment.repository.port';

@Injectable()
export class FlagSegmentRepository
  extends TypeOrmRepositoryBase<FlagSegmentEntity, FlagSegmentOrmEntity>
  implements FlagSegmentRepositoryPort
{
  constructor(
    @InjectRepository(FlagSegmentOrmEntity)
    protected readonly repository: Repository<FlagSegmentOrmEntity>,
    protected readonly mapper: FlagSegmentMapper,
    protected readonly outbox: OutboxService,
  ) {
    super();
  }

  async findOneByKey(key: string): Promise<Option<FlagSegmentEntity>> {
    return this.toOption(await this.repository.findOneBy({ key }));
  }

  async findAll(): Promise<FlagSegmentEntity[]> {
    const records = await this.repository.find({ order: { key: 'ASC' } });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async fingerprint(): Promise<string> {
    // Every column of every row, in key order — the jsonb rules and the full
    // microsecond timestamp included — so no change can leave it standing still.
    const [row] = await this.repository.query(
      `SELECT count(*)::text || ':' || coalesce(md5(string_agg(to_jsonb(t)::text, ',' ORDER BY t.key)), '') AS digest FROM feature_flag_segment t`,
    );
    return (row as { digest: string } | undefined)?.digest ?? '';
  }
}
