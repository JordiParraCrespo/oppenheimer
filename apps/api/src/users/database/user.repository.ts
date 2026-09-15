import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AggregateID,
  OutboxService,
  Paginated,
  type PaginatedQueryParams,
} from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type FindOptionsWhere, ILike, type Repository } from 'typeorm';
import type { UserEntity } from '../domain/user.entity';
import { UserMapper } from '../user.mapper';
import { UserOrmEntity } from './user.orm-entity';
import type { FindUsersParams, UserRepositoryPort } from './user.repository.port';

/**
 * TypeORM-backed adapter for the user aggregate. Translates between the domain
 * `UserEntity` and the `UserOrmEntity` persistence model via `UserMapper`, and
 * stages any domain events the aggregate collected on the transactional
 * outbox, atomically with the write that raised them.
 */
@Injectable()
export class UserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: UserMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insert(entity: UserEntity | UserEntity[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const records = entities.map((e) => this.mapper.toPersistence(e));
    await this.outbox.writeWithEvents(entities, (manager) =>
      manager.getRepository(UserOrmEntity).insert(records),
    );
  }

  async save(entity: UserEntity): Promise<UserEntity> {
    // Only profile columns are written (see UserMapper.toPersistence); `name`
    // and `image` stay under Better Auth's control.
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(UserOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findOneById(id: string): Promise<Option<UserEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByEmail(email: string): Promise<Option<UserEntity>> {
    const record = await this.repository.findOneBy({ email });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findAll(): Promise<UserEntity[]> {
    const records = await this.repository.find();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAllPaginated(params: PaginatedQueryParams): Promise<Paginated<UserEntity>> {
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

  async findUsers(params: FindUsersParams): Promise<Paginated<UserEntity>> {
    const { page, limit, role, search } = params;
    const skip = (page - 1) * limit;

    const baseWhere: FindOptionsWhere<UserOrmEntity> = {};
    if (role) baseWhere.role = role;

    // Search matches name or email; applied as an OR across the columns.
    const where: FindOptionsWhere<UserOrmEntity>[] | FindOptionsWhere<UserOrmEntity> = search
      ? [
          { ...baseWhere, firstName: ILike(`%${search}%`) },
          { ...baseWhere, lastName: ILike(`%${search}%`) },
          { ...baseWhere, email: ILike(`%${search}%`) },
        ]
      : baseWhere;

    const [records, count] = await this.repository.findAndCount({
      where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return new Paginated({
      count,
      limit,
      page,
      data: records.map((record) => this.mapper.toDomain(record)),
    });
  }

  async delete(entity: UserEntity): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(UserOrmEntity).delete({
        id: entity.id as AggregateID,
      }),
    );
    return result.affected ? result.affected > 0 : false;
  }

  transaction<T>(handler: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(() => handler());
  }
}
