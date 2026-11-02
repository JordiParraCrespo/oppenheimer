import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule, SCOPE_RESOLVER } from '@oppenheimer/backend-authz';
import { ApiTokenResource } from '../api-tokens/api-tokens.resource';
import { FeatureFlagResource } from '../feature-flags/feature-flags.resource';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { TeamOrmEntity } from '../organizations/database/team.orm-entity';
import { TeamMemberOrmEntity } from '../organizations/database/team-member.orm-entity';
import { ORGANIZATION_RESOURCES } from '../organizations/organizations.resource';
import { RoleOrmEntity } from '../roles/database/role.orm-entity';
import { RoleResource } from '../roles/roles.resource';
import { UserResource } from '../users/users.resource';
import { PrincipalResidencyChecker } from './application/principal-residency.policy';
import { ScopeResolver } from './application/scope.resolver';
import { ACCESS_GRANT_REPOSITORY } from './authz.di-tokens';
import { AccessGrantMapper } from './authz.mapper';
import { CreateAccessGrantCommandHandler } from './commands/create-access-grant/create-access-grant.command-handler';
import { CreateAccessGrantHttpController } from './commands/create-access-grant/create-access-grant.http.controller';
import { RevokeAccessGrantCommandHandler } from './commands/revoke-access-grant/revoke-access-grant.command-handler';
import { RevokeAccessGrantHttpController } from './commands/revoke-access-grant/revoke-access-grant.http.controller';
import { AccessGrantOrmEntity } from './database/access-grant.orm-entity';
import { AccessGrantRepository } from './database/access-grant.repository';
import { AccessScopeInterceptor } from './interceptors/access-scope.interceptor';
import { FindAccessGrantQueryHandler } from './queries/find-access-grant/find-access-grant.query-handler';
import { FindAccessGrantsHttpController } from './queries/find-access-grants/find-access-grants.http.controller';
import { FindAccessGrantsQueryHandler } from './queries/find-access-grants/find-access-grants.query-handler';
import { FindAuthzCatalogHttpController } from './queries/find-catalog/find-catalog.http.controller';
import { FindAuthzCatalogQueryHandler } from './queries/find-catalog/find-catalog.query-handler';

// Static routes before parameterized ones.
const httpControllers = [
  FindAuthzCatalogHttpController,
  FindAccessGrantsHttpController,
  CreateAccessGrantHttpController,
  RevokeAccessGrantHttpController,
];

const commandHandlers: Provider[] = [
  CreateAccessGrantCommandHandler,
  RevokeAccessGrantCommandHandler,
];
const queryHandlers: Provider[] = [
  FindAuthzCatalogQueryHandler,
  FindAccessGrantsQueryHandler,
  FindAccessGrantQueryHandler,
];
const mappers: Provider[] = [AccessGrantMapper];
const repositories: Provider[] = [
  { provide: ACCESS_GRANT_REPOSITORY, useClass: AccessGrantRepository },
];

/**
 * Wires the authorization kernel into the application and owns the
 * access-grant aggregate. The grants are the data `ScopeResolver` reads, so
 * splitting them into their own module would only buy a circular import.
 * Global like `RolesModule`: any feature's controllers apply
 * `AccessScopeInterceptor`, and importing this everywhere would create cycles.
 */
@Global()
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      AccessGrantOrmEntity,
      MemberOrmEntity,
      TeamOrmEntity,
      TeamMemberOrmEntity,
      RoleOrmEntity,
    ]),
    AuthzKernelModule.forFeature([
      UserResource,
      RoleResource,
      ApiTokenResource,
      FeatureFlagResource,
      ...ORGANIZATION_RESOURCES,
    ]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    PrincipalResidencyChecker,
    AccessScopeInterceptor,
    // Behind the port, so an application needing hierarchical scope resolution
    // (a manager seeing their reports' rows, a region → territory tree)
    // substitutes its own implementation without touching a call site.
    { provide: SCOPE_RESOLVER, useClass: ScopeResolver },
  ],
  exports: [SCOPE_RESOLVER, ACCESS_GRANT_REPOSITORY, AccessScopeInterceptor, TypeOrmModule],
})
export class AuthzModule {}
