import { Global, Module, type Provider, type Type } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { CredentialResolverPort } from './application/credential-resolver.port';
import { CredentialResolverRegistry } from './application/credential-resolver.registry';
import { CredentialScopeResolver } from './application/credential-scope.resolver';
import { RequestTenantResolver } from './application/request-tenant.resolver';
import {
  CREDENTIAL_SCOPE,
  CREDENTIAL_VERIFIER,
  DELEGATED_SESSION,
  REQUEST_TENANT,
  SESSION_CACHE,
} from './auth.di-tokens';
import { CompleteSignUpCommandHandler } from './commands/complete-sign-up/complete-sign-up.command-handler';
import { RotateDelegatedSessionsCommandHandler } from './commands/rotate-delegated-sessions/rotate-delegated-sessions.command-handler';
import { Account } from './database/account.orm-entity';
import { OAuthAccessTokenOrmEntity } from './database/oauth-access-token.orm-entity';
import { OAuthApplicationOrmEntity } from './database/oauth-application.orm-entity';
import { OAuthConsentOrmEntity } from './database/oauth-consent.orm-entity';
import { Session } from './database/session.orm-entity';
import { Verification } from './database/verification.orm-entity';
import { ApiAuthGuard } from './guards/api-auth.guard';
import { OptionalApiAuthGuard } from './guards/optional-api-auth.guard';
import { PoliciesGuard } from './guards/policies.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { AuthCommandBusBridge } from './infrastructure/auth-command-bus.util';
import { BetterAuthCredentialVerifierAdapter } from './infrastructure/better-auth-credential-verifier.adapter';
import { BetterAuthSessionCacheAdapter } from './infrastructure/better-auth-session-cache.adapter';
import { DelegatedSessionAdapter } from './infrastructure/delegated-session.adapter';

/**
 * The auth kernel: who is calling, with what credential, and whether the route
 * admits it. It knows nothing about the features built on it. A module that
 * owns a credential kind contributes a resolver with
 * {@link AuthModule.contributeCredentials}; what a principal may do comes
 * through the `ABILITY` port (bound by `roles`), who owns a credential through
 * `CREDENTIAL_OWNER` (bound by `users`). `auth-is-a-kernel` in
 * `.dependency-cruiser.cjs` enforces this.
 *
 * {@link ScopesGuard} is registered globally in `AppModule`; the other guards
 * are applied per controller. The Better Auth HTTP handler is mounted by
 * `AuthModule.forRoot({ auth })` in `AppModule`. Better Auth's organization and
 * team tables are registered by the modules that read them (`organizations`,
 * `authz`), not here.
 *
 * `@Global` like `RolesModule`: Nest instantiates a guard in the injector of
 * the module that uses it, so the guards' dependencies must resolve app-wide.
 */
@Global()
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      Session,
      Account,
      Verification,
      OAuthApplicationOrmEntity,
      OAuthAccessTokenOrmEntity,
      OAuthConsentOrmEntity,
    ]),
  ],
  providers: [
    // A root provider because the guard that reads it is an `APP_GUARD`,
    // outside any feature module's injector.
    CredentialResolverRegistry,
    // Hands the running app's CommandBus to the Better Auth hooks; see
    // `dispatchFromAuthHook` in auth-command-bus.util.ts.
    AuthCommandBusBridge,
    CompleteSignUpCommandHandler,
    RotateDelegatedSessionsCommandHandler,
    PoliciesGuard,
    ApiAuthGuard,
    OptionalApiAuthGuard,
    ScopesGuard,
    // The adapters are bound to the tokens their ports are named by. This is
    // the only place that decides Better Auth answers these questions.
    { provide: CREDENTIAL_VERIFIER, useClass: BetterAuthCredentialVerifierAdapter },
    { provide: CREDENTIAL_SCOPE, useClass: CredentialScopeResolver },
    { provide: DELEGATED_SESSION, useClass: DelegatedSessionAdapter },
    { provide: SESSION_CACHE, useClass: BetterAuthSessionCacheAdapter },
    // The auth guards run in the injector of whichever module applies them,
    // which is why the token (never the class) is published below.
    { provide: REQUEST_TENANT, useClass: RequestTenantResolver },
  ],
  // Guards are inbound adapters other modules apply with `@UseGuards`; the rest
  // is published as tokens, so nothing downstream names a concrete class.
  exports: [
    PoliciesGuard,
    ApiAuthGuard,
    OptionalApiAuthGuard,
    ScopesGuard,
    CredentialResolverRegistry,
    CREDENTIAL_SCOPE,
    DELEGATED_SESSION,
    REQUEST_TENANT,
    SESSION_CACHE,
    TypeOrmModule,
  ],
})
export class AuthModule {
  /**
   * The providers a module adds to contribute its own credential kinds:
   *
   * ```ts
   * providers: [...AuthModule.contributeCredentials([ApiTokenCredentialResolver])]
   * ```
   *
   * They go in the feature module's `providers`, not an imported module of the
   * kernel's: the resolver is then constructed in the injector of the module
   * that owns the credential and injects its repository ports without anything
   * published application-wide. Only the registry, provided globally, is
   * reached across. Nest constructs every declared provider, so the factory
   * below runs although nothing injects it.
   */
  static contributeCredentials(resolvers: Type<CredentialResolverPort>[]): Provider[] {
    return [
      ...resolvers,
      {
        // The token is unique per call so two contributions in one module
        // cannot overwrite one another.
        provide: Symbol('CREDENTIAL_CONTRIBUTION'),
        inject: [CredentialResolverRegistry, ...resolvers],
        useFactory: (
          registry: CredentialResolverRegistry,
          ...contributed: CredentialResolverPort[]
        ) => {
          registry.registerAll(contributed);
          return contributed;
        },
      },
    ];
  }
}
