import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { API_TOKEN_REPOSITORY, ORGANIZATION_MEMBERSHIP_READER } from './api-tokens.di-tokens';
import { ApiTokenMapper } from './api-tokens.mapper';
import { ApiTokenCredentialResolver } from './application/api-token-credential.resolver';
import { ApiTokenRevokedDomainEventHandler } from './application/event-handlers/api-token-revoked.domain-event-handler';
import { CreateApiTokenCommandHandler } from './commands/create-api-token/create-api-token.command-handler';
import { CreateApiTokenHttpController } from './commands/create-api-token/create-api-token.http.controller';
import { RevokeApiTokenCommandHandler } from './commands/revoke-api-token/revoke-api-token.command-handler';
import { RevokeApiTokenHttpController } from './commands/revoke-api-token/revoke-api-token.http.controller';
import { ApiTokenOrmEntity } from './database/api-token.orm-entity';
import { ApiTokenRepository } from './database/api-token.repository';
import { OrganizationMembershipRepository } from './database/organization-membership.repository';
import { FindApiTokenByIdQueryHandler } from './queries/find-api-token-by-id/find-api-token-by-id.query-handler';
import { FindApiTokensHttpController } from './queries/find-api-tokens/find-api-tokens.http.controller';
import { FindApiTokensQueryHandler } from './queries/find-api-tokens/find-api-tokens.query-handler';
import { FindCurrentCredentialHttpController } from './queries/find-current-credential/find-current-credential.http.controller';
import { FindCurrentCredentialQueryHandler } from './queries/find-current-credential/find-current-credential.query-handler';
import { FindGrantablePermissionsHttpController } from './queries/find-grantable-permissions/find-grantable-permissions.http.controller';
import { FindGrantablePermissionsQueryHandler } from './queries/find-grantable-permissions/find-grantable-permissions.query-handler';

// Registration order matters: `permissions` must be matched before `:id`.
const httpControllers = [
  FindCurrentCredentialHttpController,
  FindApiTokensHttpController,
  FindGrantablePermissionsHttpController,
  CreateApiTokenHttpController,
  RevokeApiTokenHttpController,
];

const commandHandlers: Provider[] = [CreateApiTokenCommandHandler, RevokeApiTokenCommandHandler];

const queryHandlers: Provider[] = [
  FindApiTokensQueryHandler,
  FindApiTokenByIdQueryHandler,
  FindGrantablePermissionsQueryHandler,
  FindCurrentCredentialQueryHandler,
];

const repositories: Provider[] = [
  { provide: API_TOKEN_REPOSITORY, useClass: ApiTokenRepository },
  {
    provide: ORGANIZATION_MEMBERSHIP_READER,
    useClass: OrganizationMembershipRepository,
  },
];

/**
 * API tokens module.
 *
 * It owns a credential kind, so it registers a resolver with the auth kernel
 * rather than the kernel knowing what an `oppenheimer_pat_…` secret is —
 * `AuthModule.forFeature` below is the whole of that contribution.
 *
 * Marked `@Global` because the resolver it contributes is constructed by the
 * kernel, for a guard registered as an `APP_GUARD`: the token repository it
 * asks has to be resolvable outside any feature module's injector.
 */
@Global()
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([ApiTokenOrmEntity, MemberOrmEntity]),
    AuthModule.forFeature([ApiTokenCredentialResolver]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...repositories,
    ApiTokenMapper,
    // Revoking a token has to reach the session cached for it; the kernel
    // publishes the port, this module knows when to call it.
    ApiTokenRevokedDomainEventHandler,
  ],
  exports: [API_TOKEN_REPOSITORY, ApiTokenMapper, TypeOrmModule],
})
export class ApiTokensModule {}
