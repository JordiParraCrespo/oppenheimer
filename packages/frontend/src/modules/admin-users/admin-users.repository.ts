import {
  AdminApi,
  type AdminCreateUserRequest,
  type AdminSessionResponseDto,
  type AdminUpdateUserRequest,
  type AdminUserResponseDto,
} from '@oppenheimer/api-client';
import { injectable } from 'inversify';
import { AppError } from '../core/errors';
import { MapApiError } from '../core/map-api-error.decorator';
import { AdminSessionEntity, AdminUserEntity } from './admin-user.entity';
import { AdminUsersErrors } from './admin-users.errors';

export interface AdminUsersListParams {
  search?: string;
  searchField?: 'email' | 'name';
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}
function toUser(data: AdminUserResponseDto): AdminUserEntity {
  return new AdminUserEntity(
    data.id,
    data.email,
    data.name,
    data.role,
    data.emailVerified,
    data.banned,
    data.banReason,
    data.banExpires ? new Date(data.banExpires) : null,
    new Date(data.createdAt),
  );
}

function toSession(data: AdminSessionResponseDto): AdminSessionEntity {
  return new AdminSessionEntity(
    data.id,
    data.userId,
    new Date(data.expiresAt),
    data.ipAddress,
    data.userAgent,
    new Date(data.createdAt),
  );
}

@injectable()
export class AdminUsersRepository {
  @MapApiError(AdminUsersErrors.FETCH_LIST_FAILED)
  async findAll(params: AdminUsersListParams = {}) {
    const result = await AdminApi.listUsers(
      params.search,
      params.searchField,
      params.limit,
      params.offset,
      params.sortBy,
      params.sortDirection,
    );
    if (!result) throw new AppError(AdminUsersErrors.FETCH_LIST_FAILED);
    return {
      data: result.users.map(toUser),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  @MapApiError(AdminUsersErrors.FETCH_FAILED)
  async findById(id: string): Promise<AdminUserEntity> {
    return toUser(await AdminApi.getUser(id));
  }

  @MapApiError(AdminUsersErrors.CREATE_FAILED)
  async create(dto: AdminCreateUserRequest): Promise<AdminUserEntity> {
    return toUser(await AdminApi.createUser(dto));
  }

  @MapApiError(AdminUsersErrors.UPDATE_FAILED)
  async update(id: string, dto: AdminUpdateUserRequest): Promise<AdminUserEntity> {
    return toUser(await AdminApi.updateUser(id, dto));
  }

  @MapApiError(AdminUsersErrors.ACTION_FAILED)
  async setPlatformRole(id: string, role: string | string[]): Promise<AdminUserEntity> {
    return toUser(await AdminApi.setRole(id, { role }));
  }

  @MapApiError(AdminUsersErrors.ACTION_FAILED)
  async ban(id: string, banReason?: string): Promise<AdminUserEntity> {
    return toUser(await AdminApi.ban(id, { banReason }));
  }

  @MapApiError(AdminUsersErrors.ACTION_FAILED)
  async unban(id: string): Promise<AdminUserEntity> {
    return toUser(await AdminApi.unban(id));
  }

  @MapApiError(AdminUsersErrors.ACTION_FAILED)
  async remove(id: string): Promise<void> {
    await AdminApi.removeUser(id);
  }

  @MapApiError(AdminUsersErrors.ACTION_FAILED)
  async sessions(id: string): Promise<AdminSessionEntity[]> {
    return (await AdminApi.listSessions(id)).map(toSession);
  }

  @MapApiError(AdminUsersErrors.ACTION_FAILED)
  async revokeSession(id: string, sessionId: string): Promise<void> {
    await AdminApi.revokeSession(id, { sessionId });
  }

  @MapApiError(AdminUsersErrors.ACTION_FAILED)
  async revokeAllSessions(id: string): Promise<void> {
    await AdminApi.revokeSessions(id);
  }

  @MapApiError(AdminUsersErrors.ACTION_FAILED)
  async setPassword(id: string, newPassword: string): Promise<void> {
    await AdminApi.setPassword(id, { newPassword });
  }
}
