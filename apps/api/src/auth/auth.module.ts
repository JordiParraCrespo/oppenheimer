import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationOrmEntity } from '../organizations/database/invitation.orm-entity';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { OrganizationOrmEntity } from '../organizations/database/organization.orm-entity';
import { TeamOrmEntity } from '../organizations/database/team.orm-entity';
import { TeamMemberOrmEntity } from '../organizations/database/team-member.orm-entity';
import { UsersModule } from '../users/user.module';
import { CredentialScopeResolver } from './application/credential-scope.resolver';
import { ApiTokenRevokedDomainEventHandler } from './application/event-handlers/api-token-revoked.domain-event-handler';
import { CREDENTIAL_SCOPE, CREDENTIAL_VERIFIER, DELEGATED_SESSION } from './auth.di-tokens';
import { CompleteSignUpCommandHandler } from './commands/complete-sign-up/complete-sign-up.command-handler';
import { Account } from './database/account.orm-entity';
import { OAuthAccessTokenOrmEntity } from './database/oauth-access-token.orm-entity';
import { OAuthApplicationOrmEntity } from './database/oauth-application.orm-entity';
import { OAuthConsentOrmEntity } from './database/oauth-consent.orm-entity';
import { Session } from './database/session.orm-entity';
import { Verification } from './database/verification.orm-entity';
import { ApiAuthGuard } from './guards/api-auth.guard';
import { PoliciesGuard } from './guards/policies.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { AuthCommandBusBridge } from './infrastructure/auth-command-bus.util';
import { BetterAuthCredentialVerifierAdapter } from './infrastructure/better-auth-credential-verifier.adapter';
import { DelegatedSessionAdapter } from './infrastructure/delegated-session.adapter';

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
 * - {@link AuthCommandBusBridge} — lets the Better Auth sign-up hook dispatch
 *   `CompleteSignUpCommand` instead of writing other modules' tables behind
 *   the domain's back, and takes the bus back when the module is destroyed.
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
    CqrsModule,
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
    // Hands the running app's CommandBus to the Better Auth hooks, which are
    // configured at module scope and cannot inject it. See `auth-command-bus.util.ts`.
    AuthCommandBusBridge,
    // The one handler that knows what sign-up owes a new account.
    CompleteSignUpCommandHandler,
    PoliciesGuard,
    ApiAuthGuard,
    ScopesGuard,
    // The adapters are bound to the tokens their ports are named by. This is
    // the only place that decides Better Auth answers these questions.
    { provide: CREDENTIAL_VERIFIER, useClass: BetterAuthCredentialVerifierAdapter },
    { provide: CREDENTIAL_SCOPE, useClass: CredentialScopeResolver },
    { provide: DELEGATED_SESSION, useClass: DelegatedSessionAdapter },
  ],
  // Guards are inbound adapters other modules apply with `@UseGuards`; the rest
  // is published as tokens, so nothing downstream names a concrete class.
  exports: [
    PoliciesGuard,
    ApiAuthGuard,
    ScopesGuard,
    CREDENTIAL_SCOPE,
    DELEGATED_SESSION,
    TypeOrmModule,
  ],
})
export class AuthModule {}
