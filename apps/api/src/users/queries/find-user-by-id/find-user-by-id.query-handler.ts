import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
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
    return requireFound(found, UserErrors.NOT_FOUND);
  }
}
