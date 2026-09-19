import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CREDENTIAL_OWNER } from '../auth/auth.di-tokens';
import { UserDeletedDomainEventHandler } from './application/event-handlers/user-deleted.domain-event-handler';
import { DeleteUserCommandHandler } from './commands/delete-user/delete-user.command-handler';
import { DeleteUserHttpController } from './commands/delete-user/delete-user.http.controller';
import { UpdateUserCommandHandler } from './commands/update-user/update-user.command-handler';
import { UpdateUserHttpController } from './commands/update-user/update-user.http.controller';
import { UserOrmEntity } from './database/user.orm-entity';
import { UserRepository } from './database/user.repository';
import { UserCredentialOwnerAdapter } from './infrastructure/credential-owner.adapter';
import { FindUserByIdHttpController } from './queries/find-user-by-id/find-user-by-id.http.controller';
import { FindUserByIdQueryHandler } from './queries/find-user-by-id/find-user-by-id.query-handler';
import { FindUsersHttpController } from './queries/find-users/find-users.http.controller';
import { FindUsersQueryHandler } from './queries/find-users/find-users.query-handler';
import { GetMeHttpController } from './queries/get-me/get-me.http.controller';
import { GetMyPermissionsHttpController } from './queries/get-my-permissions/get-my-permissions.http.controller';
import { GetMyPermissionsQueryHandler } from './queries/get-my-permissions/get-my-permissions.query-handler';
import { USER_REPOSITORY } from './user.di-tokens';
import { UserMapper } from './user.mapper';

// Controller registration order matters: `me` must be matched before `:id`.
const httpControllers = [
  FindUsersHttpController,
  GetMeHttpController,
  GetMyPermissionsHttpController,
  FindUserByIdHttpController,
  UpdateUserHttpController,
  DeleteUserHttpController,
];

const commandHandlers: Provider[] = [UpdateUserCommandHandler, DeleteUserCommandHandler];

const queryHandlers: Provider[] = [
  FindUsersQueryHandler,
  FindUserByIdQueryHandler,
  GetMyPermissionsQueryHandler,
];

const eventHandlers: Provider[] = [UserDeletedDomainEventHandler];

const mappers: Provider[] = [UserMapper];

const repositories: Provider[] = [{ provide: USER_REPOSITORY, useClass: UserRepository }];

/** The auth kernel's question about a credential's owner, answered from here. */
const ports: Provider[] = [{ provide: CREDENTIAL_OWNER, useClass: UserCredentialOwnerAdapter }];

/**
 * Marked `@Global` for the same reason as `roles` and `api-tokens`: the auth
 * kernel resolves a request's credential inside globally registered guards,
 * and a credential resolver contributed by a feature module is instantiated in
 * that contribution's own injector. What both of them ask this module for —
 * the credential's owner — therefore has to be resolvable application-wide.
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
  ],
  exports: [USER_REPOSITORY, CREDENTIAL_OWNER, TypeOrmModule],
})
export class UsersModule {}
