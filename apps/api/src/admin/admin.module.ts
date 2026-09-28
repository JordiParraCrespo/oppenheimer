import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ADMIN_AUTH } from './admin.di-tokens';
import { BanUserCommandHandler } from './commands/ban-user/ban-user.command-handler';
import { BanUserHttpController } from './commands/ban-user/ban-user.http.controller';
import { CreateUserCommandHandler } from './commands/create-user/create-user.command-handler';
import { CreateUserHttpController } from './commands/create-user/create-user.http.controller';
import { ImpersonateUserCommandHandler } from './commands/impersonate-user/impersonate-user.command-handler';
import { ImpersonateUserHttpController } from './commands/impersonate-user/impersonate-user.http.controller';
import { RemoveUserCommandHandler } from './commands/remove-user/remove-user.command-handler';
import { RemoveUserHttpController } from './commands/remove-user/remove-user.http.controller';
import { RevokeUserSessionCommandHandler } from './commands/revoke-user-session/revoke-user-session.command-handler';
import { RevokeUserSessionHttpController } from './commands/revoke-user-session/revoke-user-session.http.controller';
import { RevokeUserSessionsCommandHandler } from './commands/revoke-user-sessions/revoke-user-sessions.command-handler';
import { RevokeUserSessionsHttpController } from './commands/revoke-user-sessions/revoke-user-sessions.http.controller';
import { SetUserPasswordCommandHandler } from './commands/set-user-password/set-user-password.command-handler';
import { SetUserPasswordHttpController } from './commands/set-user-password/set-user-password.http.controller';
import { SetUserRoleCommandHandler } from './commands/set-user-role/set-user-role.command-handler';
import { SetUserRoleHttpController } from './commands/set-user-role/set-user-role.http.controller';
import { StopImpersonatingCommandHandler } from './commands/stop-impersonating/stop-impersonating.command-handler';
import { StopImpersonatingHttpController } from './commands/stop-impersonating/stop-impersonating.http.controller';
import { UnbanUserCommandHandler } from './commands/unban-user/unban-user.command-handler';
import { UnbanUserHttpController } from './commands/unban-user/unban-user.http.controller';
import { UpdateUserCommandHandler } from './commands/update-user/update-user.command-handler';
import { UpdateUserHttpController } from './commands/update-user/update-user.http.controller';
import { AdminAuthGateway } from './infrastructure/admin-auth.gateway';
import { GetUserHttpController } from './queries/get-user/get-user.http.controller';
import { GetUserQueryHandler } from './queries/get-user/get-user.query-handler';
import { ListUserSessionsHttpController } from './queries/list-user-sessions/list-user-sessions.http.controller';
import { ListUserSessionsQueryHandler } from './queries/list-user-sessions/list-user-sessions.query-handler';
import { ListUsersHttpController } from './queries/list-users/list-users.http.controller';
import { ListUsersQueryHandler } from './queries/list-users/list-users.query-handler';

// Registration order is the order the routes are matched and documented in:
// the static `stop-impersonating` and `users/:id/sessions/revoke` ahead of the
// bare `users/:id`.
const httpControllers = [
  ListUsersHttpController,
  CreateUserHttpController,
  StopImpersonatingHttpController,
  RevokeUserSessionHttpController,
  GetUserHttpController,
  UpdateUserHttpController,
  RemoveUserHttpController,
  SetUserRoleHttpController,
  BanUserHttpController,
  UnbanUserHttpController,
  ImpersonateUserHttpController,
  ListUserSessionsHttpController,
  RevokeUserSessionsHttpController,
  SetUserPasswordHttpController,
];

const commandHandlers: Provider[] = [
  CreateUserCommandHandler,
  UpdateUserCommandHandler,
  RemoveUserCommandHandler,
  SetUserRoleCommandHandler,
  SetUserPasswordCommandHandler,
  BanUserCommandHandler,
  UnbanUserCommandHandler,
  ImpersonateUserCommandHandler,
  StopImpersonatingCommandHandler,
  RevokeUserSessionCommandHandler,
  RevokeUserSessionsCommandHandler,
];

const queryHandlers: Provider[] = [
  ListUsersQueryHandler,
  GetUserQueryHandler,
  ListUserSessionsQueryHandler,
];

// The one outbound dependency, bound to the token its port is named by.
const adapters: Provider[] = [{ provide: ADMIN_AUTH, useClass: AdminAuthGateway }];

/**
 * Super-admin user management: `/v1/admin/users` (list, get, create, update,
 * set-role, ban, unban, impersonate, remove, sessions, set-password), gated by
 * CASL `manage User`.
 *
 * Better Auth's admin plugin owns the accounts, so there is no aggregate here —
 * but there is a port (`infrastructure/admin-auth.port.ts`) naming what the use
 * cases need from it, a gateway that speaks to `auth.api.*`, and one use-case
 * slice per operation, so the typed, Swagger-documented surface the generated
 * api-client reads is built the same way as every other module's.
 */
@Module({
  imports: [CqrsModule],
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...adapters],
})
export class AdminModule {}
