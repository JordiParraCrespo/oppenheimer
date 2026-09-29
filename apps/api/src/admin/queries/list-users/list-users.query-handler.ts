import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminUserListResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { ListUsersQuery } from './list-users.query';

/** A page of the platform's accounts, searched and sorted as asked. */
@QueryHandler(ListUsersQuery)
export class ListUsersQueryHandler
  implements IQueryHandler<ListUsersQuery, AdminUserListResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(query: ListUsersQuery): Promise<AdminUserListResponseDto> {
    return this.admin.listUsers(query.headers, query.filters);
  }
}
