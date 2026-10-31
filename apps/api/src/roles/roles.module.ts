import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/user.module';
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
import { AuthzVersionRepository } from './database/authz-version.repository';
import { RoleOrmEntity } from './database/role.orm-entity';
import { RoleRepository } from './database/role.repository';
import { RoleCatalogVersionOrmEntity } from './database/role-catalog-version.orm-entity';
import { UserRoleOrmEntity } from './database/user-role.orm-entity';
import { UserRoleRepository } from './database/user-role.repository';
import { UserRoleVersionOrmEntity } from './database/user-role-version.orm-entity';
import { FindRoleByIdHttpController } from './queries/find-role-by-id/find-role-by-id.http.controller';
import { FindRoleByIdQueryHandler } from './queries/find-role-by-id/find-role-by-id.query-handler';
import { FindRolesHttpController } from './queries/find-roles/find-roles.http.controller';
import { FindRolesQueryHandler } from './queries/find-roles/find-roles.query-handler';
import { FindUserRolesHttpController } from './queries/find-user-roles/find-user-roles.http.controller';
import { FindUserRolesQueryHandler } from './queries/find-user-roles/find-user-roles.query-handler';
import { AUTHZ_VERSION_REPOSITORY, ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from './roles.di-tokens';
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
  { provide: AUTHZ_VERSION_REPOSITORY, useClass: AuthzVersionRepository },
];

/**
 * Roles / RBAC module: the roles, their assignments and the version counters
 * every write to them bumps. Marked `@Global` so the repository ports — which
 * `authz`'s `AbilityFactory` reads to build every request's ability — are
 * available application-wide without circular module imports.
 */
@Global()
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      RoleOrmEntity,
      UserRoleOrmEntity,
      RoleCatalogVersionOrmEntity,
      UserRoleVersionOrmEntity,
    ]),
    UsersModule,
  ],
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...mappers, ...repositories, RoleGrantPolicy],
  exports: [
    ROLE_REPOSITORY,
    USER_ROLE_REPOSITORY,
    AUTHZ_VERSION_REPOSITORY,
    RoleGrantPolicy,
    RoleMapper,
    TypeOrmModule,
  ],
})
export class RolesModule {}
