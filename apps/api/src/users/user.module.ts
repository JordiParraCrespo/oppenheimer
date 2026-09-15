import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDeletedDomainEventHandler } from './application/event-handlers/user-deleted.domain-event-handler';
import { DeleteUserHttpController } from './commands/delete-user/delete-user.http.controller';
import { DeleteUserService } from './commands/delete-user/delete-user.service';
import { UpdateUserHttpController } from './commands/update-user/update-user.http.controller';
import { UpdateUserService } from './commands/update-user/update-user.service';
import { UserOrmEntity } from './database/user.orm-entity';
import { UserRepository } from './database/user.repository';
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

const commandHandlers: Provider[] = [UpdateUserService, DeleteUserService];

const queryHandlers: Provider[] = [
  FindUsersQueryHandler,
  FindUserByIdQueryHandler,
  GetMyPermissionsQueryHandler,
];

const eventHandlers: Provider[] = [UserDeletedDomainEventHandler];

const mappers: Provider[] = [UserMapper];

const repositories: Provider[] = [{ provide: USER_REPOSITORY, useClass: UserRepository }];

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...eventHandlers, ...mappers, ...repositories],
  exports: [USER_REPOSITORY, TypeOrmModule],
})
export class UsersModule {}
