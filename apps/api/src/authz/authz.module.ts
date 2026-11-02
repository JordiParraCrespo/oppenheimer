import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiTokenResource } from '../api-tokens/api-tokens.resource';
import { FeatureFlagResource } from '../feature-flags/feature-flags.resource';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { TeamOrmEntity } from '../organizations/database/team.orm-entity';
import { TeamMemberOrmEntity } from '../organizations/database/team-member.orm-entity';
import { ORGANIZATION_RESOURCES } from '../organizations/organizations.resource';
import { RoleOrmEntity } from '../roles/database/role.orm-entity';
import { RoleResource } from '../roles/roles.resource';
import { UserResource } from '../users/users.resource';
import { AbilityFactory } from './application/ability.factory';
import { GlobalRoleRegistry } from './application/global-role.registry';
import { PrincipalResidencyChecker } from './application/principal-residency.policy';
import { ResourceRegistry } from './application/resource.registry';
import { ScopeResolver } from './application/scope.resolver';
import { ABILITY, ACCESS_GRANT_REPOSITORY, SCOPE_RESOLVER } from './authz.di-tokens';
import { AccessGrantMapper } from './authz.mapper';
import { CreateAccessGrantCommandHandler } from './commands/create-access-grant/create-access-grant.command-handler';
import { CreateAccessGrantHttpController } from './commands/create-access-grant/create-access-grant.http.controller';
import { RevokeAccessGrantCommandHandler } from './commands/revoke-access-grant/revoke-access-grant.command-handler';
import { RevokeAccessGrantHttpController } from './commands/revoke-access-grant/revoke-access-grant.http.controller';
import { AccessGrantOrmEntity } from './database/access-grant.orm-entity';
import { AccessGrantRepository } from './database/access-grant.repository';
import type { ResourceDefinition } from './domain/resource-definition.types';
import { PoliciesGuard } from './guards/policies.guard';
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

/** Provider token collecting the declarations one `forFeature` call passes. */
const RESOURCE_DEFINITIONS = Symbol('AUTHZ_RESOURCE_DEFINITIONS');

/**
 * What `AuthzModule.forFeature` returns: a module of its own class, so a
 * feature's registration does not instantiate `AuthzModule`'s controllers a
 * second time. Registration happens when the module is instantiated, so a
 * module that is never imported contributes nothing, which keeps the catalog
 * an accurate description of what the running application exposes.
 */
@Module({})
class AuthzResourcesModule {
  static forFeature(definitions: readonly ResourceDefinition[]): DynamicModule {
    return {
      module: AuthzResourcesModule,
      providers: [
        { provide: RESOURCE_DEFINITIONS, useValue: definitions },
        {
          provide: `${String(RESOURCE_DEFINITIONS)}_REGISTRATION`,
          inject: [ResourceRegistry, RESOURCE_DEFINITIONS],
          useFactory: (registry: ResourceRegistry, resources: readonly ResourceDefinition[]) => {
            registry.registerAll(resources);
            return true;
          },
        },
      ],
    };
  }
}

/**
 * Authorization, all of it: which rows a caller reaches (the resource
 * registry, `AccessScope` and `ScopeResolver`, the access grants it reads),
 * and what they may do to them (`AbilityFactory` behind the `ABILITY` port,
 * `PoliciesGuard` and `@CheckPolicies`). The grants are the data
 * `ScopeResolver` reads, so splitting them into their own module would only
 * buy a circular import.
 *
 * Global: Nest builds a guard in the injector of the module that applies it,
 * and every feature's controllers apply `PoliciesGuard` and
 * `AccessScopeInterceptor`; importing this everywhere would create cycles.
 * The roles themselves stay in `roles`, which owns the tables and bumps the
 * version counters `AbilityFactory` reads.
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
    AuthzResourcesModule.forFeature([
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
    ResourceRegistry,
    GlobalRoleRegistry,
    AbilityFactory,
    { provide: ABILITY, useExisting: AbilityFactory },
    PoliciesGuard,
    // Behind the port, so an application needing hierarchical scope resolution
    // (a manager seeing their reports' rows, a region → territory tree)
    // substitutes its own implementation without touching a call site.
    { provide: SCOPE_RESOLVER, useClass: ScopeResolver },
  ],
  exports: [
    SCOPE_RESOLVER,
    ACCESS_GRANT_REPOSITORY,
    AccessScopeInterceptor,
    ResourceRegistry,
    AbilityFactory,
    ABILITY,
    PoliciesGuard,
    TypeOrmModule,
  ],
})
export class AuthzModule {
  /**
   * Contribute a feature's resource declarations to the registry:
   * `AuthzModule.forFeature([ProjectResource])` in the module that owns them.
   */
  static forFeature(definitions: readonly ResourceDefinition[]): DynamicModule {
    return AuthzResourcesModule.forFeature(definitions);
  }
}
