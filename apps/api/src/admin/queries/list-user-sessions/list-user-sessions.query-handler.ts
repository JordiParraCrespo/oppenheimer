import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminSessionResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { ListUserSessionsQuery } from './list-user-sessions.query';

/** An account's live sign-in sessions — never their tokens. */
@QueryHandler(ListUserSessionsQuery)
export class ListUserSessionsQueryHandler
  implements IQueryHandler<ListUserSessionsQuery, AdminSessionResponseDto[]>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(query: ListUserSessionsQuery): Promise<AdminSessionResponseDto[]> {
    return this.admin.listSessions(query.headers, query.userId);
  }
}
