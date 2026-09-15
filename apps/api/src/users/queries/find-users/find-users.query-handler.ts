import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Paginated } from '@oppenheimer/backend-ddd';
import type { UserRepositoryPort } from '../../database/user.repository.port';
import type { UserEntity } from '../../domain/user.entity';
import { USER_REPOSITORY } from '../../user.di-tokens';
import { FindUsersQuery } from './find-users.query';

@QueryHandler(FindUsersQuery)
export class FindUsersQueryHandler implements IQueryHandler<FindUsersQuery, Paginated<UserEntity>> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  execute(query: FindUsersQuery): Promise<Paginated<UserEntity>> {
    return this.userRepository.findUsers({
      page: query.page,
      limit: query.limit,
      role: query.role,
      search: query.search,
    });
  }
}
