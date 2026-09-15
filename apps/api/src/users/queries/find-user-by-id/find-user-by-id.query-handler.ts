import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { UserRepositoryPort } from '../../database/user.repository.port';
import type { UserEntity } from '../../domain/user.entity';
import { UserErrors } from '../../domain/user.errors';
import { USER_REPOSITORY } from '../../user.di-tokens';
import { FindUserByIdQuery } from './find-user-by-id.query';

@QueryHandler(FindUserByIdQuery)
export class FindUserByIdQueryHandler implements IQueryHandler<FindUserByIdQuery, UserEntity> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(query: FindUserByIdQuery): Promise<UserEntity> {
    const found = await this.userRepository.findOneById(query.userId);
    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);
    return found.unwrap();
  }
}
