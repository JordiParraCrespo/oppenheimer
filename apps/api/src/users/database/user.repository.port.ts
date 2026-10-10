import type { Paginated, RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Role } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { UserEntity } from '../domain/user.entity';

export interface FindUsersParams {
  page: number;
  limit: number;
  role?: Role;
  search?: string;
}

export interface UserRepositoryPort extends RepositoryPort<UserEntity> {
  findOneByEmail(email: string): Promise<Option<UserEntity>>;
  /** Used by the GitHub link flow to find the account a login belongs to. */
  findOneByPhone(phone: string): Promise<UserEntity | null>;
  findUsers(params: FindUsersParams): Promise<Paginated<UserEntity>>;
}
