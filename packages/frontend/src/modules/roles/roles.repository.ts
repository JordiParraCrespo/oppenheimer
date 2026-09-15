import { AuthorizationApi, type RoleResponseDto, RolesApi } from '@oppenheimer/api-client';
import type { CreateRoleDto, PermissionDefinition, UpdateRoleDto } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { AppError } from '../core/errors';
import { MapApiError } from '../core/map-api-error.decorator';
import {
  type AuthorizationCatalog,
  type FindRolesParams,
  RoleEntity,
  type RolePage,
} from './role.entity';
import { RolesErrors } from './roles.errors';

function toRole(data: RoleResponseDto): RoleEntity {
  return new RoleEntity(
    data.id,
    data.name,
    data.description,
    data.isSystem,
    data.organizationId ?? null,
    data.permissions.map(toPermission).filter((permission) => permission !== null),
    new Date(data.createdAt),
    new Date(data.updatedAt),
  );
}

function toPermission(value: Record<string, unknown>): PermissionDefinition | null {
  if (typeof value.action !== 'string' || typeof value.subject !== 'string') return null;
  return {
    action: value.action,
    subject: value.subject,
    ...(isRecord(value.conditions) ? { conditions: value.conditions } : {}),
    ...(Array.isArray(value.fields)
      ? {
          fields: value.fields.filter((field): field is string => typeof field === 'string'),
        }
      : {}),
    ...(typeof value.inverted === 'boolean' ? { inverted: value.inverted } : {}),
    ...(typeof value.reason === 'string' ? { reason: value.reason } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@injectable()
export class RolesRepository {
  @MapApiError(RolesErrors.FETCH_LIST_FAILED)
  async findAll(params: FindRolesParams = {}): Promise<RolePage> {
    // The endpoint counts pages from 1 and defaults to 20; the table asks for
    // its own page and size, and callers that need the whole set (the members
    // tab's role facet) pass a wide limit rather than the old hardcoded 100.
    const result = await RolesApi.findAll(params.search, params.limit, params.page);
    if (!result) throw new AppError(RolesErrors.FETCH_LIST_FAILED);
    return { data: result.data.map(toRole), meta: result.meta };
  }

  @MapApiError(RolesErrors.CREATE_FAILED)
  async create(dto: CreateRoleDto): Promise<RoleEntity> {
    const result = await RolesApi.create(dto);
    if (!result) throw new AppError(RolesErrors.CREATE_FAILED);
    return toRole(result);
  }

  @MapApiError(RolesErrors.UPDATE_FAILED)
  async update(id: string, dto: UpdateRoleDto): Promise<RoleEntity> {
    const result = await RolesApi.update(id, dto);
    if (!result) throw new AppError(RolesErrors.UPDATE_FAILED);
    return toRole(result);
  }

  @MapApiError(RolesErrors.DELETE_FAILED)
  async remove(id: string): Promise<void> {
    await RolesApi.remove(id);
  }

  @MapApiError(RolesErrors.FETCH_USER_ROLES_FAILED)
  async findForUser(userId: string): Promise<RoleEntity[]> {
    const result = await RolesApi.findUserRoles(userId);
    if (!result) throw new AppError(RolesErrors.FETCH_USER_ROLES_FAILED);
    return result.map(toRole);
  }

  @MapApiError(RolesErrors.ASSIGN_FAILED)
  async assignToUser(userId: string, roleIds: string[]): Promise<RoleEntity[]> {
    const result = await RolesApi.assign(userId, { roleIds });
    if (!result) throw new AppError(RolesErrors.ASSIGN_FAILED);
    return result.map(toRole);
  }

  @MapApiError(RolesErrors.FETCH_CATALOG_FAILED)
  async catalog(): Promise<AuthorizationCatalog> {
    const result = await AuthorizationApi.catalog();
    if (!result) throw new AppError(RolesErrors.FETCH_CATALOG_FAILED);
    return result;
  }
}
