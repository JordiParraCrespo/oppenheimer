import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { API_TOKEN_REPOSITORY, ORGANIZATION_MEMBERSHIP_READER } from './api-tokens.di-tokens';
import { ApiTokenMapper } from './api-tokens.mapper';
import { CreateApiTokenHttpController } from './commands/create-api-token/create-api-token.http.controller';
import { CreateApiTokenService } from './commands/create-api-token/create-api-token.service';
import { RevokeApiTokenHttpController } from './commands/revoke-api-token/revoke-api-token.http.controller';
import { RevokeApiTokenService } from './commands/revoke-api-token/revoke-api-token.service';
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

const commandHandlers: Provider[] = [CreateApiTokenService, RevokeApiTokenService];

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
 * Marked `@Global` because the auth layer's credential resolver — used by the
 * globally registered `ScopesGuard` — depends on the token repository, and
 * that guard is instantiated outside any feature module's injector.
 */
@Global()
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([ApiTokenOrmEntity, MemberOrmEntity])],
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...repositories, ApiTokenMapper],
  exports: [API_TOKEN_REPOSITORY, ApiTokenMapper, TypeOrmModule],
})
export class ApiTokensModule {}
