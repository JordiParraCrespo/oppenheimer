import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { GetUserQuery } from './get-user.query';

@QueryHandler(GetUserQuery)
export class GetUserQueryHandler implements IQueryHandler<GetUserQuery, AdminUserResponseDto> {
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(query: GetUserQuery): Promise<AdminUserResponseDto> {
    return this.admin.getUser(query.headers, query.userId);
  }
}
