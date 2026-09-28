import { heyApiSdk, type UserResponseDto } from '@oppenheimer/api-client';
import type { PermissionDefinition, Role } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { unwrapBody } from '../core/errors';
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

/**
 * `GET /users/me/permissions` serves raw CASL rules, so the wire type is a bag
 * of unknown members (`conditions` and `fields` are free-form). Keep the rules
 * that carry the two members `PermissionDefinition` requires — a rule missing
 * either could not be applied to an ability anyway — so nothing has to be cast.
 */
function toPermissions(rules: Array<{ [key: string]: unknown }>): PermissionDefinition[] {
  return rules.filter(
    (rule): rule is { [key: string]: unknown } & PermissionDefinition =>
      typeof rule.action === 'string' && typeof rule.subject === 'string',
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
    const result = await unwrapBody(
      heyApiSdk.findUsers({ query: { search, role, limit, page } }),
      UsersErrors.FETCH_LIST_FAILED,
    );
    return {
      data: result.data.map(toEntity),
      meta: result.meta,
    };
  }

  @MapApiError(UsersErrors.FETCH_FAILED)
  async me(): Promise<UserEntity> {
    const data = await unwrapBody(heyApiSdk.getMe(), UsersErrors.FETCH_FAILED);
    return toEntity(data);
  }

  /**
   * The caller's own effective permissions (the union of their roles), used to
   * gate which routes the sidebar shows. Plain CASL rules, not an entity — the
   * app rebuilds an ability from them with `defineAbilitiesFromPermissions`.
   */
  @MapApiError(UsersErrors.FETCH_FAILED)
  async myPermissions(): Promise<PermissionDefinition[]> {
    const data = await unwrapBody(heyApiSdk.getMyPermissions(), UsersErrors.FETCH_FAILED);
    return toPermissions(data.permissions);
  }

  @MapApiError(UsersErrors.FETCH_FAILED)
  async findById(id: string): Promise<UserEntity> {
    const data = await unwrapBody(
      heyApiSdk.findUserById({ path: { id } }),
      UsersErrors.FETCH_FAILED,
    );
    return toEntity(data);
  }
}
