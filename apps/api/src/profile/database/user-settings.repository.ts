import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, Paginated, type PaginatedQueryParams } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type Repository } from 'typeorm';
import type { UserSettingsEntity } from '../domain/user-settings.entity';
import { ProfileMapper } from '../profile.mapper';
import { UserSettingsOrmEntity } from './user-settings.orm-entity';
import type { UserSettingsRepositoryPort } from './user-settings.repository.port';

/**
 * TypeORM-backed adapter for a user's preferences. Translates between the
 * domain `UserSettingsEntity` and its persistence model via `ProfileMapper`,
 * and stages any domain events the aggregate collected on the transactional
 * outbox, atomically with the write that raised them.
 */
@Injectable()
export class UserSettingsRepository implements UserSettingsRepositoryPort {
  constructor(
    @InjectRepository(UserSettingsOrmEntity)
    private readonly repository: Repository<UserSettingsOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: ProfileMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insert(entity: UserSettingsEntity | UserSettingsEntity[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const records = entities.map((e) => this.mapper.toPersistence(e));
    await this.outbox.writeWithEvents(entities, (manager) =>
      manager.getRepository(UserSettingsOrmEntity).insert(records),
    );
  }

  /**
   * Upsert: the primary key is the user's id, so this both creates the row on a
   * first save and updates it thereafter. That is what lets the read side hand
   * out unsaved defaults without the write side caring.
   */
  async save(entity: UserSettingsEntity): Promise<UserSettingsEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(UserSettingsOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findOneById(userId: string): Promise<Option<UserSettingsEntity>> {
    const record = await this.repository.findOneBy({ userId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findAll(): Promise<UserSettingsEntity[]> {
    const records = await this.repository.find();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAllPaginated(params: PaginatedQueryParams): Promise<Paginated<UserSettingsEntity>> {
    const [records, count] = await this.repository.findAndCount({
      skip: params.offset,
      take: params.limit,
      order: { createdAt: params.orderBy.param === 'asc' ? 'ASC' : 'DESC' },
    });
    return new Paginated({
      count,
      limit: params.limit,
      page: params.page,
      data: records.map((record) => this.mapper.toDomain(record)),
    });
  }

  async delete(entity: UserSettingsEntity): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(UserSettingsOrmEntity).delete({ userId: entity.userId }),
    );
    return result.affected ? result.affected > 0 : false;
  }

  transaction<T>(handler: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(() => handler());
  }
}
