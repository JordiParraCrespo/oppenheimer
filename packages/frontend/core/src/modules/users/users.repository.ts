import { type UserResponseDto, UsersApi } from '@oppenheimer/api-client';
import type { PermissionDefinition, Role, UpdateUserDto } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { AppError } from '../core/errors';
import { MapApiError } from '../core/map-api-error.decorator';
import { UserEntity } from './user.entity';
import { UsersErrors } from './users.errors';

function toEntity(data: UserResponseDto): UserEntity {
  return new UserEntity(
    data.id,
    data.email,
    data.firstName,
    data.lastName,
    data.role,
    data.isActive,
    new Date(data.createdAt),
    new Date(data.updatedAt),
  );
}

@injectable()
export class UsersRepository {
  @MapApiError(UsersErrors.FETCH_LIST_FAILED)
  async findAll(
    page?: number,
    limit?: number,
    search?: string,
    role?: Role,
  ): Promise<{
    data: UserEntity[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const result = await UsersApi.findAll(search, role, limit, page);
    if (!result) throw new AppError(UsersErrors.FETCH_LIST_FAILED);
    return {
      data: result.data.map(toEntity),
      meta: result.meta,
    };
  }

  @MapApiError(UsersErrors.FETCH_FAILED)
  async me(): Promise<UserEntity> {
    const data = await UsersApi.me();
    if (!data) throw new AppError(UsersErrors.FETCH_FAILED);
    return toEntity(data);
  }

  /**
   * The caller's own effective permissions (the union of their roles), used to
   * gate which routes the sidebar shows. Plain CASL rules, not an entity — the
   * app rebuilds an ability from them with `defineAbilitiesFromPermissions`.
   */
  @MapApiError(UsersErrors.FETCH_FAILED)
  async myPermissions(): Promise<PermissionDefinition[]> {
    const data = await UsersApi.permissions();
    if (!data) throw new AppError(UsersErrors.FETCH_FAILED);
    return data.permissions as PermissionDefinition[];
  }

  @MapApiError(UsersErrors.FETCH_FAILED)
  async findById(id: string): Promise<UserEntity> {
    const data = await UsersApi.findOne(id);
    if (!data) throw new AppError(UsersErrors.FETCH_FAILED);
    return toEntity(data);
  }

  @MapApiError(UsersErrors.UPDATE_FAILED)
  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const data = await UsersApi.update(id, dto);
    if (!data) throw new AppError(UsersErrors.UPDATE_FAILED);
    return toEntity(data);
  }

  @MapApiError(UsersErrors.DELETE_FAILED)
  async delete(id: string): Promise<void> {
    await UsersApi.remove(id);
  }
}
