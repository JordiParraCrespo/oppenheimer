import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppError, likeContains } from '@oppenheimer/backend-core';
import { OutboxService, Paginated, TypeOrmRepositoryBase } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import { type FindOptionsWhere, ILike, type Repository } from 'typeorm';
import type { UserEntity } from '../domain/user.entity';
import { UserErrors } from '../domain/user.errors';
import { UserMapper } from '../user.mapper';
import { UserOrmEntity } from './user.orm-entity';
import type { FindUsersParams, UserRepositoryPort } from './user.repository.port';

const UNIQUE_VIOLATION = '23505';
/** The name `UserOrmEntity` and the migration give the constraint. */
const USERNAME_CONSTRAINT = 'UQ_user_username';

@Injectable()
export class UserRepository
  extends TypeOrmRepositoryBase<UserEntity, UserOrmEntity>
  implements UserRepositoryPort
{
  constructor(
    @InjectRepository(UserOrmEntity)
    protected readonly repository: Repository<UserOrmEntity>,
    protected readonly mapper: UserMapper,
    protected readonly outbox: OutboxService,
  ) {
    super();
  }

  override async save(entity: UserEntity): Promise<UserEntity> {
    try {
      return await super.save(entity);
    } catch (error) {
      // The constraint is the rule; this is where a taken handle becomes the
      // catalog's answer rather than a 500.
      if (isUsernameTaken(error)) throw new AppError(UserErrors.USERNAME_TAKEN);
      throw error;
    }
  }

  async findOneByEmail(email: string): Promise<Option<UserEntity>> {
    return this.toOption(await this.repository.findOneBy({ email }));
  }

  async findUsers(params: FindUsersParams): Promise<Paginated<UserEntity>> {
    const { page, limit, role, search } = params;
    const skip = (page - 1) * limit;

    const baseWhere: FindOptionsWhere<UserOrmEntity> = {};
    if (role) baseWhere.role = role;

    // Search matches name or email, as an OR across the columns, with the
    // term's `%` and `_` matched literally. IDX_user_search_trgm serves it for
    // terms of three characters or more.
    const needle = search ? ILike(likeContains(search)) : undefined;
    const where: FindOptionsWhere<UserOrmEntity>[] | FindOptionsWhere<UserOrmEntity> = needle
      ? [
          { ...baseWhere, firstName: needle },
          { ...baseWhere, lastName: needle },
          { ...baseWhere, email: needle },
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
}

function isUsernameTaken(error: unknown): boolean {
  const driver = error as { code?: string; constraint?: string };
  return driver?.code === UNIQUE_VIOLATION && driver?.constraint === USERNAME_CONSTRAINT;
}
