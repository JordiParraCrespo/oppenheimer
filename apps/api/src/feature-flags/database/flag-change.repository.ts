import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from '@oppenheimer/backend-ddd';
import type { FindOptionsWhere, Repository } from 'typeorm';
import { FlagChangeOrmEntity } from './flag-change.orm-entity';
import type {
  FindFlagChangesParams,
  FlagChangeRecord,
  FlagChangeRepositoryPort,
} from './flag-change.repository.port';

/** TypeORM adapter for the flag audit trail. */
@Injectable()
export class FlagChangeRepository implements FlagChangeRepositoryPort {
  constructor(
    @InjectRepository(FlagChangeOrmEntity)
    private readonly repository: Repository<FlagChangeOrmEntity>,
  ) {}

  async record(change: FlagChangeRecord): Promise<void> {
    const record = new FlagChangeOrmEntity();
    record.id = change.id;
    record.subjectType = change.subjectType;
    record.subjectKey = change.subjectKey;
    record.action = change.action;
    record.actorId = change.actorId;
    record.comment = change.comment;
    record.before = change.before;
    record.after = change.after;
    record.createdAt = change.createdAt;

    const insert = this.repository.createQueryBuilder().insert().into(FlagChangeOrmEntity);
    // `QueryDeepPartialEntity` cannot represent free-form jsonb; see RoleRepository.
    await insert
      .values(record as Parameters<typeof insert.values>[0])
      // At-least-once delivery: a redelivered event lands on the same id.
      .orIgnore()
      .execute();
  }

  async find(params: FindFlagChangesParams): Promise<Paginated<FlagChangeRecord>> {
    const where: FindOptionsWhere<FlagChangeOrmEntity> = {};
    if (params.subjectType) where.subjectType = params.subjectType;
    if (params.subjectKey) where.subjectKey = params.subjectKey;

    const [records, count] = await this.repository.findAndCount({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      order: { createdAt: 'DESC' },
    });

    return new Paginated({
      count,
      limit: params.limit,
      page: params.page,
      data: records.map((record) => ({
        id: record.id,
        subjectType: record.subjectType,
        subjectKey: record.subjectKey,
        action: record.action as FlagChangeRecord['action'],
        actorId: record.actorId,
        comment: record.comment,
        before: record.before,
        after: record.after,
        createdAt: record.createdAt,
      })),
    });
  }
}
