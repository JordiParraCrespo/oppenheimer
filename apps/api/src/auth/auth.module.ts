import { Global, Module, type Provider, type Type } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { CredentialResolverPort } from './application/credential-resolver.port';
import { CredentialResolverRegistry } from './application/credential-resolver.registry';
import { CredentialScopeResolver } from './application/credential-scope.resolver';
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
 * The auth kernel.
 *
 * It owns what every request is asked on the way in — who is calling, with
 * what credential, and whether the route admits it — and it knows nothing
 * about the features built on top of it. A module that owns a credential kind
 * contributes a resolver with {@link AuthModule.contributeCredentials}; what a
 * principal
 * may do it asks through the `ABILITY` port, which `roles` binds; who a
 * credential belongs to it asks through `CREDENTIAL_OWNER`, which `users`
 * binds. `auth-is-a-kernel` in `.dependency-cruiser.cjs` is the enforced
 * statement of that sentence.
 *
 * It registers the Better Auth tables it owns with TypeORM (so the schema is
 * created / migrated alongside the rest of the app) and exposes the guards
 * that authenticate and authorize requests:
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
 * the root `AppModule`. The OAuth tables (MCP plugin) are Better-Auth-owned
 * too and are grouped here alongside session/account. The organization and
 * team tables are Better Auth's as well, but they are registered by the
 * modules that read them (`organizations`, `authz`) — registering them here
 * too would only be this module reaching into theirs.
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
    // The credential kinds this application accepts, collected at boot from
    // whoever called `forFeature`. A root provider because the guard that
    // reads it is an `APP_GUARD`, outside any feature module's injector.
    CredentialResolverRegistry,
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
    CredentialResolverRegistry,
    CREDENTIAL_SCOPE,
    DELEGATED_SESSION,
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
   * They go in the **feature module's** `providers`, not in an imported
   * module of the kernel's, and that placement is the whole point: the
   * resolver is constructed in the injector of the module that owns the
   * credential, so it injects that module's own repository ports without
   * anything having to be published application-wide. The only thing reached
   * across is the registry, which the kernel provides globally.
   *
   * Registration happens when the module is instantiated — Nest constructs
   * every provider a module declares, so the factory below runs although
   * nothing injects it — which means a module that is never imported
   * contributes nothing, and the registry describes the application that is
   * actually running.
   */
  static contributeCredentials(resolvers: Type<CredentialResolverPort>[]): Provider[] {
    return [
      ...resolvers,
      {
        // Constructing this provider *is* the registration: the resolvers are
        // instantiated as its dependencies and handed to the kernel's registry.
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
