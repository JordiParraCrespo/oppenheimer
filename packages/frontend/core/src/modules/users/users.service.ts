import type { PermissionDefinition } from '@oppenheimer/shared';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { UserEntity } from './user.entity';
import type { UsersRepository } from './users.repository';

@injectable()
export class UsersService {
  constructor(
    @inject(TOKENS.UserRepository)
    private readonly usersRepository: UsersRepository,
  ) {}

  async me(): Promise<UserEntity> {
    return this.usersRepository.me();
  }

  async myPermissions(): Promise<PermissionDefinition[]> {
    return this.usersRepository.myPermissions();
  }
}
