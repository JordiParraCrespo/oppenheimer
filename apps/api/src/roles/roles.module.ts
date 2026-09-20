import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ABILITY } from '../auth/auth.di-tokens';
import { UsersModule } from '../users/user.module';
import { AbilityFactory } from './application/ability.factory';
import { RoleGrantPolicy } from './application/role-grant.policy';
import { AssignDefaultRoleCommandHandler } from './commands/assign-default-role/assign-default-role.command-handler';
import { AssignUserRolesCommandHandler } from './commands/assign-user-roles/assign-user-roles.command-handler';
import { AssignUserRolesHttpController } from './commands/assign-user-roles/assign-user-roles.http.controller';
import { CreateRoleCommandHandler } from './commands/create-role/create-role.command-handler';
import { CreateRoleHttpController } from './commands/create-role/create-role.http.controller';
import { DeleteRoleCommandHandler } from './commands/delete-role/delete-role.command-handler';
import { DeleteRoleHttpController } from './commands/delete-role/delete-role.http.controller';
import { UpdateRoleCommandHandler } from './commands/update-role/update-role.command-handler';
import { UpdateRoleHttpController } from './commands/update-role/update-role.http.controller';
import { UpdateRolePermissionsCommandHandler } from './commands/update-role-permissions/update-role-permissions.command-handler';
import { UpdateRolePermissionsHttpController } from './commands/update-role-permissions/update-role-permissions.http.controller';
import { RoleOrmEntity } from './database/role.orm-entity';
import { RoleRepository } from './database/role.repository';
import { UserRoleOrmEntity } from './database/user-role.orm-entity';
import { UserRoleRepository } from './database/user-role.repository';
import { FindRoleByIdHttpController } from './queries/find-role-by-id/find-role-by-id.http.controller';
import { FindRoleByIdQueryHandler } from './queries/find-role-by-id/find-role-by-id.query-handler';
import { FindRolesHttpController } from './queries/find-roles/find-roles.http.controller';
import { FindRolesQueryHandler } from './queries/find-roles/find-roles.query-handler';
import { FindUserRolesHttpController } from './queries/find-user-roles/find-user-roles.http.controller';
import { FindUserRolesQueryHandler } from './queries/find-user-roles/find-user-roles.query-handler';
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from './roles.di-tokens';
import { RoleMapper } from './roles.mapper';

// Register list/static routes before parameterized ones.
const httpControllers = [
  FindRolesHttpController,
  CreateRoleHttpController,
  FindRoleByIdHttpController,
  UpdateRoleHttpController,
  UpdateRolePermissionsHttpController,
  DeleteRoleHttpController,
  FindUserRolesHttpController,
  AssignUserRolesHttpController,
];

const commandHandlers: Provider[] = [
  AssignDefaultRoleCommandHandler,
  CreateRoleCommandHandler,
  UpdateRoleCommandHandler,
  UpdateRolePermissionsCommandHandler,
  DeleteRoleCommandHandler,
  AssignUserRolesCommandHandler,
];

const queryHandlers: Provider[] = [
  FindRolesQueryHandler,
  FindRoleByIdQueryHandler,
  FindUserRolesQueryHandler,
];

const mappers: Provider[] = [RoleMapper];

const repositories: Provider[] = [
  { provide: ROLE_REPOSITORY, useClass: RoleRepository },
  { provide: USER_ROLE_REPOSITORY, useClass: UserRoleRepository },
];

/**
 * Roles / RBAC module. Marked `@Global` so the {@link AbilityFactory} (used by
 * the auth `PoliciesGuard` from every feature module) and the repository ports
 * are available application-wide without circular module imports.
 *
 * The same factory is bound to the auth kernel's `ABILITY` token: the guard
 * asks "what may this principal do" through a port so that `auth` names no
 * feature module, and this module is the one that answers.
 */
@Global()
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([RoleOrmEntity, UserRoleOrmEntity]), UsersModule],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    AbilityFactory,
    { provide: ABILITY, useExisting: AbilityFactory },
    RoleGrantPolicy,
  ],
  exports: [
    ROLE_REPOSITORY,
    USER_ROLE_REPOSITORY,
    AbilityFactory,
    ABILITY,
    RoleGrantPolicy,
    RoleMapper,
    TypeOrmModule,
  ],
})
export class RolesModule {}
