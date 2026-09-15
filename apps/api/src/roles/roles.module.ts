import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/user.module';
import { AssignUserRolesHttpController } from './commands/assign-user-roles/assign-user-roles.http.controller';
import { AssignUserRolesService } from './commands/assign-user-roles/assign-user-roles.service';
import { CreateRoleHttpController } from './commands/create-role/create-role.http.controller';
import { CreateRoleService } from './commands/create-role/create-role.service';
import { DeleteRoleHttpController } from './commands/delete-role/delete-role.http.controller';
import { DeleteRoleService } from './commands/delete-role/delete-role.service';
import { UpdateRoleHttpController } from './commands/update-role/update-role.http.controller';
import { UpdateRoleService } from './commands/update-role/update-role.service';
import { UpdateRolePermissionsHttpController } from './commands/update-role-permissions/update-role-permissions.http.controller';
import { UpdateRolePermissionsService } from './commands/update-role-permissions/update-role-permissions.service';
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
import { AbilityFactory } from './services/ability.factory';
import { RoleGrantPolicy } from './services/role-grant.policy';

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
  CreateRoleService,
  UpdateRoleService,
  UpdateRolePermissionsService,
  DeleteRoleService,
  AssignUserRolesService,
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
    RoleGrantPolicy,
  ],
  exports: [
    ROLE_REPOSITORY,
    USER_ROLE_REPOSITORY,
    AbilityFactory,
    RoleGrantPolicy,
    RoleMapper,
    TypeOrmModule,
  ],
})
export class RolesModule {}
