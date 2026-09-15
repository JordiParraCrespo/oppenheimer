import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationOrmEntity } from '../organizations/database/invitation.orm-entity';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { OrganizationOrmEntity } from '../organizations/database/organization.orm-entity';
import { TeamOrmEntity } from '../organizations/database/team.orm-entity';
import { TeamMemberOrmEntity } from '../organizations/database/team-member.orm-entity';
import { UsersModule } from '../users/user.module';
import { ApiTokenRevokedDomainEventHandler } from './application/event-handlers/api-token-revoked.domain-event-handler';
import { Account } from './entities/account.entity';
import { OAuthAccessTokenOrmEntity } from './entities/oauth-access-token.entity';
import { OAuthApplicationOrmEntity } from './entities/oauth-application.entity';
import { OAuthConsentOrmEntity } from './entities/oauth-consent.entity';
import { Session } from './entities/session.entity';
import { Verification } from './entities/verification.entity';
import { ApiAuthGuard } from './guards/api-auth.guard';
import { PoliciesGuard } from './guards/policies.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { CredentialScopeResolver } from './services/credential-scope.resolver';
import { DelegatedSessionService } from './services/delegated-session.service';

/**
 * Registers the Better Auth tables with TypeORM (so the schema is created /
 * migrated alongside the rest of the app) and exposes the guards that
 * authenticate and authorize requests:
 *
 * - {@link ApiAuthGuard} — authenticates a session cookie, an API token or an
 *   OAuth access token, and populates `request.user` / `request.scopeContext`.
 * - {@link PoliciesGuard} — CASL check against the caller's roles.
 * - {@link ScopesGuard} — registered globally in `AppModule`; narrows scoped
 *   credentials to the permissions and organizations they were granted.
 *
 * The Better Auth HTTP handler itself is wired up via
 * `AuthModule.forRoot({ auth })` from `@thallesp/nestjs-better-auth` in
 * the root `AppModule`. The organization/team tables are Better-Auth-owned too
 * (organization plugin), as are the OAuth tables (MCP plugin); all are grouped
 * here alongside session/account.
 */
/**
 * Marked `@Global` for the same reason as `RolesModule`: the guards below are
 * applied by controllers in every feature module, and Nest instantiates a guard
 * in the injector of the module that uses it — so their dependencies have to be
 * resolvable application-wide.
 */
@Global()
@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      Session,
      Account,
      Verification,
      OrganizationOrmEntity,
      MemberOrmEntity,
      InvitationOrmEntity,
      TeamOrmEntity,
      TeamMemberOrmEntity,
      OAuthApplicationOrmEntity,
      OAuthAccessTokenOrmEntity,
      OAuthConsentOrmEntity,
    ]),
  ],
  providers: [
    ApiTokenRevokedDomainEventHandler,
    PoliciesGuard,
    ApiAuthGuard,
    ScopesGuard,
    CredentialScopeResolver,
    DelegatedSessionService,
  ],
  exports: [
    PoliciesGuard,
    ApiAuthGuard,
    ScopesGuard,
    CredentialScopeResolver,
    DelegatedSessionService,
    TypeOrmModule,
  ],
})
export class AuthModule {}
