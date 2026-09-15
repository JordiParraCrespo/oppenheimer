import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import type { UserEntity } from '../../../users/domain/user.entity';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { ProfileErrors } from '../../domain/profile.errors';
import { GetProfileQuery } from './get-profile.query';

/**
 * Reads the caller's own account. The user row is the users module's aggregate
 * — this module reads it through that module's port rather than keeping a
 * second mapping of the same table.
 */
@QueryHandler(GetProfileQuery)
export class GetProfileQueryHandler implements IQueryHandler<GetProfileQuery, UserEntity> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(query: GetProfileQuery): Promise<UserEntity> {
    const found = await this.userRepository.findOneById(query.userId);
    if (found.isNone()) throw new AppError(ProfileErrors.NOT_FOUND);
    return found.unwrap();
  }
}
