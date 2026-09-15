import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AggregateID,
  OutboxService,
  Paginated,
  type PaginatedQueryParams,
} from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type FindOptionsWhere, ILike, In, IsNull, type Repository } from 'typeorm';
import type { RoleEntity } from '../domain/role.entity';
import { RoleMapper } from '../roles.mapper';
import { RoleOrmEntity } from './role.orm-entity';
import type { FindRolesParams, RoleRepositoryPort } from './role.repository.port';

/**
 * TypeORM-backed adapter for the role aggregate. Translates between the domain
 * `RoleEntity` and the `RoleOrmEntity` persistence model via `RoleMapper` and
 * stages any collected domain events on the transactional outbox, atomically
 * with the write that raised them.
 */
@Injectable()
export class RoleRepository implements RoleRepositoryPort {
  constructor(
    @InjectRepository(RoleOrmEntity)
    private readonly repository: Repository<RoleOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: RoleMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insert(entity: RoleEntity | RoleEntity[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const records = entities.map((e) => this.mapper.toPersistence(e));
    await this.outbox.writeWithEvents(entities, (manager) => {
      const repository = manager.getRepository(RoleOrmEntity);
      // Cast around TypeORM's `QueryDeepPartialEntity` recursion, which can't
      // represent the free-form `permissions` jsonb (Record<string, unknown>).
      return repository.insert(records as Parameters<typeof repository.insert>[0]);
    });
  }

  async save(entity: RoleEntity): Promise<RoleEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(RoleOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findOneById(id: string, organizationId?: string | null): Promise<Option<RoleEntity>> {
    const record = await this.repository.findOne({
      where: scopedWhere({ id }, organizationId),
    });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByName(name: string, organizationId?: string | null): Promise<Option<RoleEntity>> {
    const record = await this.repository.findOne({
      where: scopedWhere({ name }, organizationId),
    });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByIds(ids: string[], organizationId?: string | null): Promise<RoleEntity[]> {
    if (ids.length === 0) return [];
    const records = await this.repository.find({
      where: scopedWhere({ id: In(ids) }, organizationId),
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAll(): Promise<RoleEntity[]> {
    const records = await this.repository.find();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAllPaginated(params: PaginatedQueryParams): Promise<Paginated<RoleEntity>> {
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

  async findRoles(params: FindRolesParams): Promise<Paginated<RoleEntity>> {
    const { page, limit, search, organizationId } = params;
    const skip = (page - 1) * limit;

    const [records, count] = await this.repository.findAndCount({
      where: searchWhere(search, organizationId),
      skip,
      take: limit,
      order: { name: 'ASC' },
    });

    return new Paginated({
      count,
      limit,
      page,
      data: records.map((record) => this.mapper.toDomain(record)),
    });
  }

  async delete(entity: RoleEntity): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(RoleOrmEntity).delete({
        id: entity.id as AggregateID,
      }),
    );
    return result.affected ? result.affected > 0 : false;
  }

  transaction<T>(handler: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(() => handler());
  }
}

function scopedWhere(
  where: FindOptionsWhere<RoleOrmEntity>,
  organizationId?: string | null,
): FindOptionsWhere<RoleOrmEntity> | FindOptionsWhere<RoleOrmEntity>[] {
  if (organizationId === undefined) return where;
  if (organizationId === null) return { ...where, organizationId: IsNull() };
  return [
    { ...where, organizationId: IsNull() },
    { ...where, organizationId },
  ];
}

/**
 * A role matches on its name **or** its description.
 *
 * The description sits on the row under the name, so a reader searching for
 * words they can see there has to find the role — matching the name alone
 * answers a visible phrase with an empty table. TypeORM ORs an array of `where`
 * objects, and the organization scope has to be applied inside each branch
 * rather than around them, or a global role matches on one field and an
 * organization's role on the other.
 */
function searchWhere(
  search: string | undefined,
  organizationId?: string | null,
): FindOptionsWhere<RoleOrmEntity> | FindOptionsWhere<RoleOrmEntity>[] {
  if (!search) return scopedWhere({}, organizationId);

  const needle = ILike(`%${search}%`);

  return [{ name: needle }, { description: needle }].flatMap((match) => {
    const scoped = scopedWhere(match, organizationId);
    return Array.isArray(scoped) ? scoped : [scoped];
  });
}
