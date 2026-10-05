import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, TypeOrmRepositoryBase } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { EntityManager, Repository } from 'typeorm';
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

  async findOneByKey(key: string, manager?: EntityManager): Promise<Option<FlagSegmentEntity>> {
    return this.toOption(await this.on(manager).findOneBy({ key }));
  }

  async findAll(manager?: EntityManager): Promise<FlagSegmentEntity[]> {
    const records = await this.on(manager).find({ order: { key: 'ASC' } });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async delete(entity: FlagSegmentEntity, manager?: EntityManager): Promise<boolean> {
    if (!manager) return super.delete(entity);
    const result = await manager.getRepository(FlagSegmentOrmEntity).delete({ id: entity.id });
    // Events commit or roll back with the caller's transaction. The caller
    // discards the aggregate afterwards, so they are not cleared here.
    await this.outbox.stageEvents(manager, entity.domainEvents);
    return (result.affected ?? 0) > 0;
  }

  private on(manager?: EntityManager): Repository<FlagSegmentOrmEntity> {
    return manager ? manager.getRepository(FlagSegmentOrmEntity) : this.repository;
  }

  async fingerprint(): Promise<string> {
    // The same digest as `FeatureFlagRepository.fingerprint`.
    const [row] = await this.repository.query(
      `SELECT count(*)::text || ':' || coalesce(md5(string_agg(to_jsonb(t)::text, ',' ORDER BY t.key)), '') AS digest FROM feature_flag_segment t`,
    );
    return (row as { digest: string } | undefined)?.digest ?? '';
  }
}
