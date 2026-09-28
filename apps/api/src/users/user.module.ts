import { Global, Module, type Provider, type Type } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CREDENTIAL_OWNER } from '../auth/auth.di-tokens';
import type { AccountErasurePort } from './application/account-erasure.port';
import { AccountErasureRegistry } from './application/account-erasure.registry';
import { UserDeactivatedDomainEventHandler } from './application/event-handlers/user-deactivated.domain-event-handler';
import { UserDeletedDomainEventHandler } from './application/event-handlers/user-deleted.domain-event-handler';
import { DeleteOwnAccountHttpController } from './commands/delete-own-account/delete-own-account.http.controller';
import { DeleteUserCommandHandler } from './commands/delete-user/delete-user.command-handler';
import { DeleteUserHttpController } from './commands/delete-user/delete-user.http.controller';
import { UpdateUserCommandHandler } from './commands/update-user/update-user.command-handler';
import { UpdateUserHttpController } from './commands/update-user/update-user.http.controller';
import { UserOrmEntity } from './database/user.orm-entity';
import { UserRepository } from './database/user.repository';
import { AccountSessionsGateway } from './infrastructure/account-sessions.gateway';
import { UserCredentialOwnerAdapter } from './infrastructure/credential-owner.adapter';
import { FindUserByIdHttpController } from './queries/find-user-by-id/find-user-by-id.http.controller';
import { FindUserByIdQueryHandler } from './queries/find-user-by-id/find-user-by-id.query-handler';
import { FindUsersHttpController } from './queries/find-users/find-users.http.controller';
import { FindUsersQueryHandler } from './queries/find-users/find-users.query-handler';
import { GetMeHttpController } from './queries/get-me/get-me.http.controller';
import { GetMyPermissionsHttpController } from './queries/get-my-permissions/get-my-permissions.http.controller';
import { GetMyPermissionsQueryHandler } from './queries/get-my-permissions/get-my-permissions.query-handler';
import { ACCOUNT_SESSIONS, USER_REPOSITORY } from './user.di-tokens';
import { UserMapper } from './user.mapper';

// Controller registration order matters: `me` must be matched before `:id`.
const httpControllers = [
  FindUsersHttpController,
  GetMeHttpController,
  GetMyPermissionsHttpController,
  FindUserByIdHttpController,
  UpdateUserHttpController,
  DeleteUserHttpController,
  DeleteOwnAccountHttpController,
];

const commandHandlers: Provider[] = [UpdateUserCommandHandler, DeleteUserCommandHandler];

const queryHandlers: Provider[] = [
  FindUsersQueryHandler,
  FindUserByIdQueryHandler,
  GetMyPermissionsQueryHandler,
];

const eventHandlers: Provider[] = [
  UserDeletedDomainEventHandler,
  UserDeactivatedDomainEventHandler,
];

const mappers: Provider[] = [UserMapper];

const repositories: Provider[] = [{ provide: USER_REPOSITORY, useClass: UserRepository }];

/**
 * The auth kernel's question about a credential's owner, answered from here;
 * and the revocation a deactivated account is owed, done through Better Auth.
 */
const ports: Provider[] = [
  { provide: CREDENTIAL_OWNER, useClass: UserCredentialOwnerAdapter },
  { provide: ACCOUNT_SESSIONS, useClass: AccountSessionsGateway },
];

/**
 * Marked `@Global` for one reason: the auth kernel resolves an OAuth grant
 * itself, in `AuthModule`'s injector, and it asks this module who the grant
 * belongs to through `CREDENTIAL_OWNER`. The kernel may not import this module
 * (`auth-is-a-kernel` in `.dependency-cruiser.cjs`), so the binding has to be
 * resolvable application-wide. A contributed credential resolver does *not*
 * need this — it is built in its own module's injector — so this is about the
 * kernel's own path, nothing else.
 */
@Global()
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    ...mappers,
    ...repositories,
    ...ports,
    AccountErasureRegistry,
  ],
  exports: [USER_REPOSITORY, CREDENTIAL_OWNER, TypeOrmModule, AccountErasureRegistry],
})
export class UsersModule {
  /**
   * The providers a module adds to say what goes with an account:
   *
   * ```ts
   * providers: [...UsersModule.contributeAccountErasure([HostAccountErasure])]
   * ```
   *
   * The same shape as `HostsModule.contributeUsage`: the implementation is
   * built in the injector of the module that owns the rows, so it uses that
   * module's own repository and nothing is published application-wide.
   */
  static contributeAccountErasure(contributions: Type<AccountErasurePort>[]): Provider[] {
    return [
      ...contributions,
      {
        provide: Symbol('ACCOUNT_ERASURE_CONTRIBUTION'),
        inject: [AccountErasureRegistry, ...contributions],
        useFactory: (registry: AccountErasureRegistry, ...contributed: AccountErasurePort[]) => {
          registry.registerAll(contributed);
          return contributed;
        },
      },
    ];
  }
}
