import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppError, requestMemo } from '@oppenheimer/backend-core';
import { parseScopeString, toResourceScope } from '@oppenheimer/shared';
import { AUTH_FAILURE_LIMITER, CREDENTIAL_OWNER, CREDENTIAL_VERIFIER } from '../auth.di-tokens';
import { AuthErrors } from '../domain/auth.errors';
import type { ScopeContext, ScopedRequest } from '../domain/scope-context.types';
import type {
  CredentialVerifierPort,
  VerifiedSession,
} from '../infrastructure/credential-verifier.port';
import type { AuthFailureLimiterPort } from './auth-failure-limiter.port';
import type { CredentialOwnerPort } from './credential-owner.port';
import type { CredentialResolverPort } from './credential-resolver.port';
import { CredentialResolverRegistry } from './credential-resolver.registry';
import type { CredentialScopePort } from './credential-scope.port';

/** Header carrying an API token, for clients that prefer it over `Authorization`. */
const API_KEY_HEADER = 'x-api-key';

/** `requestMemo` keys: the guards each ask, and share one answer per request. */
const CREDENTIAL_RESOLUTION = Symbol('oppenheimer.credentialResolution');
const SESSION_RESOLUTION = Symbol('oppenheimer.sessionResolution');
const RATE_LIMIT_KEY = Symbol('oppenheimer.rateLimitKey');

/**
 * What a request's credential resolved to. `session` is set when resolving it
 * already verified a Better Auth session (a session token presented as a
 * bearer), and left `undefined` when nothing was presented — the cookie is
 * then looked up only if someone asks for the session.
 */
interface Resolution {
  scope: ScopeContext | null;
  session?: VerifiedSession | null;
}

/**
 * Turns the credential on a request into a {@link ScopeContext}.
 *
 * The kernel knows two kinds itself, because they are the ones it issues:
 *
 * - **Browser session** (cookie, or a session token presented as a bearer) —
 *   no scope context; the person's roles govern.
 * - **OAuth access token** — verified by Better Auth's MCP plugin, its granted
 *   scopes carried through.
 *
 * Every other kind is a **contribution**: the module that owns a credential
 * contributes a {@link CredentialResolverPort} through
 * `AuthModule.contributeCredentials`, and
 * this resolver asks each registered resolver, in registration order, whether
 * the presented string is theirs. API tokens (`oppenheimer_pat_…`) are the
 * first such contribution; nothing here names them.
 *
 * A bearer credential that cannot be resolved is rejected rather than ignored:
 * silently falling back to a cookie would let a stale token act with the
 * browser session's full rights, which is precisely what scoping exists to
 * prevent.
 *
 * Each credential is verified **once per request**, whoever asks: the global
 * scopes guard, `ApiAuthGuard`, a host guard. A session token presented as a
 * bearer is verified while ruling out an OAuth grant, and that verdict is the
 * session `ApiAuthGuard` authenticates with — it used to be verified, thrown
 * away, and verified twice more.
 */
@Injectable()
export class CredentialScopeResolver implements CredentialScopePort {
  constructor(
    private readonly registry: CredentialResolverRegistry,
    @Inject(CREDENTIAL_VERIFIER)
    private readonly credentials: CredentialVerifierPort,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
    @Optional()
    @Inject(AUTH_FAILURE_LIMITER)
    private readonly failures?: AuthFailureLimiterPort,
  ) {}

  /** Resolve (once per request) the scoped credential, or `null` for a session. */
  async resolve(request: ScopedRequest): Promise<ScopeContext | null> {
    return (await this.resolution(request)).scope;
  }

  async resolveSession(request: ScopedRequest): Promise<VerifiedSession | null> {
    const resolution = await this.resolution(request);
    if (resolution.scope) return null;
    if (resolution.session !== undefined) return resolution.session;
    return requestMemo(request, SESSION_RESOLUTION, () =>
      this.credentials.verifySession(request.headers),
    );
  }

  rateLimitKey(request: ScopedRequest): Promise<string | null> {
    return requestMemo(request, RATE_LIMIT_KEY, () => this.deriveRateLimitKey(request));
  }

  private async deriveRateLimitKey(request: ScopedRequest): Promise<string | null> {
    const presented = extractCredential(request);
    if (!presented) {
      const cookie = await this.credentials.signedSessionCookie(request.headers);
      return cookie ? `session:${digest(cookie).slice(0, 32)}` : null;
    }

    // A single-use kind is bucketed by what it resolves to; see `singleUse`.
    if (this.contributionFor(presented)?.singleUse) {
      const scope = await this.resolve(request).catch(() => null);
      return scope ? `cred:${scope.credentialId}` : null;
    }
    return credentialKey(presented);
  }

  private resolution(request: ScopedRequest): Promise<Resolution> {
    return requestMemo(request, CREDENTIAL_RESOLUTION, () => this.doResolve(request));
  }

  private async doResolve(request: ScopedRequest): Promise<Resolution> {
    const presented = extractCredential(request);
    if (!presented) return { scope: null };

    try {
      const resolution = await this.resolvePresented(presented, request);
      this.failures?.recordSuccess(
        this.contributionFor(presented)?.singleUse && resolution.scope
          ? `cred:${resolution.scope.credentialId}`
          : credentialKey(presented),
      );
      return resolution;
    } catch (error) {
      if (error instanceof AppError && error.code === AuthErrors.INVALID_CREDENTIAL.code) {
        this.failures?.recordFailure(request.ip ?? 'unknown');
      }
      throw error;
    }
  }

  private async resolvePresented(presented: string, request: ScopedRequest): Promise<Resolution> {
    // First contribution that claims the string owns the outcome: a resolver
    // that recognises and then refuses throws, and that refusal is the answer.
    const resolver = this.contributionFor(presented);
    if (resolver) return { scope: await resolver.resolve(presented, request) };

    return this.resolveOAuthToken(request);
  }

  private contributionFor(presented: string): CredentialResolverPort | undefined {
    return this.registry.all().find((candidate) => candidate.recognises(presented));
  }

  private async resolveOAuthToken(request: ScopedRequest): Promise<Resolution> {
    const grant = await this.credentials.verifyOAuthGrant(request.headers);

    // Not an OAuth access token. It may still be a session token presented as
    // a bearer credential — that is how the mobile app and the CLI's sign-in
    // flow authenticate. Those carry no scopes, so hand them back to the
    // session path rather than rejecting them.
    //
    // OAuth is asked first on purpose. A session lookup that misses the cache
    // falls back to Postgres, so asking it first would add a query to every
    // OAuth request; this order costs a bearer session one grant miss instead.
    if (!grant) return { scope: null, session: await this.requireSession(request) };

    const { scopes } = parseScopeString(grant.scopes);

    return {
      scope: {
        kind: 'oauth',
        // The grant has no id of its own, so derive a stable one by digesting
        // the access token — never the token itself, which would put a live
        // secret into cache keys and logs.
        credentialId: `oauth:${digest(grant.accessToken).slice(0, 32)}`,
        userId: grant.userId,
        owner: await this.owners.requireActiveOwner(grant.userId),
        scopes,
        // OAuth grants are not organization-restricted: the consent screen
        // grants permissions, and the user's own memberships bound their reach.
        resourceScope: toResourceScope(null),
        expiresAt: grant.accessTokenExpiresAt ? new Date(grant.accessTokenExpiresAt) : null,
      },
    };
  }

  /**
   * A bearer credential no contribution recognised and that is not an OAuth
   * grant is only acceptable if the provider recognises it as a session token;
   * anything else is rejected rather than ignored, so a stale token can never
   * fall through to a cookie session's full rights. The session is kept: it is
   * the one `ApiAuthGuard` authenticates the request with.
   */
  private async requireSession(request: ScopedRequest): Promise<VerifiedSession> {
    const session = await this.credentials.verifySession(request.headers);
    if (!session) throw new AppError(AuthErrors.INVALID_CREDENTIAL);
    return session;
  }
}

/** The raw credential string, from either supported header. */
function extractCredential(request: ScopedRequest): string | null {
  const apiKeyHeader = request.headers[API_KEY_HEADER];
  const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
  if (apiKey?.trim()) return apiKey.trim();

  const authorization = request.headers.authorization;
  if (!authorization) return null;

  const [scheme, ...rest] = authorization.split(' ');
  if (scheme.toLowerCase() !== 'bearer') return null;

  const value = rest.join(' ').trim();
  return value || null;
}

/** The rate-limit key of a presented secret: one bucket per secret, never the secret. */
function credentialKey(presented: string): string {
  return `cred:${digest(presented).slice(0, 32)}`;
}

/**
 * SHA-256 of a secret, hex, used only to derive a stable id or bucket. The
 * digest is what goes into cache keys and logs; the secret itself never
 * leaves this function.
 */
function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
