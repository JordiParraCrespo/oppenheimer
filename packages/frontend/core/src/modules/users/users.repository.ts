import { heyApiSdk, type UserResponseDto } from '@oppenheimer/api-client';
import type { PermissionDefinition } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { callApi } from '../core/errors';

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
  me(): Promise<UserEntity> {
    return callApi(UsersErrors.FETCH_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.getMe());
      return toEntity(data);
    });
  }

  /**
   * The caller's own effective permissions (the union of their roles), used to
   * gate which routes the sidebar shows. Plain CASL rules, not an entity — the
   * app rebuilds an ability from them with `defineAbilitiesFromPermissions`.
   */
  myPermissions(): Promise<PermissionDefinition[]> {
    return callApi(UsersErrors.FETCH_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.getMyPermissions());
      return toPermissions(data.permissions);
    });
  }
}
