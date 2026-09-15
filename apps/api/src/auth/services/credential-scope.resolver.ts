import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { parseScopeString, toResourceScope } from '@oppenheimer/shared';
import { API_TOKEN_REPOSITORY } from '../../api-tokens/api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../../api-tokens/database/api-token.repository.port';
import { ApiTokenErrors } from '../../api-tokens/domain/api-token.errors';
import { hashApiTokenSecret, isApiTokenSecret } from '../../api-tokens/domain/api-token.secret';
import type { UserRepositoryPort } from '../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../users/user.di-tokens';
import { auth } from '../auth';
import { betterAuthHeaders } from '../better-auth.util';
import type { CredentialOwner, ScopeContext, ScopedRequest } from '../scope-context';

/** Header carrying an API token, for clients that prefer it over `Authorization`. */
const API_KEY_HEADER = 'x-api-key';

/** Memoizes resolution so the guards can each ask without a second lookup. */
const RESOLUTION = Symbol('oppenheimer.credentialResolution');

interface WithResolution {
  [RESOLUTION]?: Promise<ScopeContext | null>;
}

/**
 * Turns the credential on a request into a {@link ScopeContext}.
 *
 * Three kinds of credential reach the API:
 *
 * - **Browser session cookie** — no scope context; the user's roles govern.
 * - **API token** (`oppenheimer_pat_…`, in `Authorization: Bearer` or `x-api-key`)
 *   — looked up by digest, checked for revocation, expiry and source IP.
 * - **OAuth access token** — verified by Better Auth's MCP plugin, its granted
 *   scopes carried through.
 *
 * A bearer credential that cannot be resolved is rejected rather than ignored:
 * silently falling back to a cookie would let a stale token act with the
 * browser session's full rights, which is precisely what scoping exists to
 * prevent.
 */
@Injectable()
export class CredentialScopeResolver {
  private readonly logger = new Logger(CredentialScopeResolver.name);

  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokens: ApiTokenRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
  ) {}

  /** Resolve (once per request) the scoped credential, or `null` for a session. */
  resolve(request: ScopedRequest): Promise<ScopeContext | null> {
    const carrier = request as ScopedRequest & WithResolution;
    carrier[RESOLUTION] ??= this.doResolve(request);
    return carrier[RESOLUTION];
  }

  private async doResolve(request: ScopedRequest): Promise<ScopeContext | null> {
    const presented = this.extractCredential(request);
    if (!presented) return null;

    if (isApiTokenSecret(presented)) {
      return this.resolveApiToken(presented, request);
    }
    return this.resolveOAuthToken(request);
  }

  /** The raw credential string, from either supported header. */
  private extractCredential(request: ScopedRequest): string | null {
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

  private async resolveApiToken(secret: string, request: ScopedRequest): Promise<ScopeContext> {
    const found = await this.apiTokens.findOneByHash(hashApiTokenSecret(secret));
    if (found.isNone()) throw new AppError(ApiTokenErrors.INVALID_CREDENTIAL);

    const token = found.unwrap();
    const rejection = token.rejectionReason({
      now: new Date(),
      ipAddress: sourceAddress(request),
    });

    if (rejection === 'ip-not-allowed') throw new AppError(ApiTokenErrors.IP_NOT_ALLOWED);
    // Revoked and expired share the credential error: distinguishing them
    // would tell an attacker which of their guesses used to be real.
    if (rejection) throw new AppError(ApiTokenErrors.INVALID_CREDENTIAL);

    // Best-effort usage stamp — never let it fail the request.
    void this.apiTokens
      .touchLastUsedAt(token.id, new Date())
      .catch((error) => this.logger.warn(`Could not record token usage: ${describe(error)}`));

    return {
      kind: 'api-token',
      credentialId: token.id,
      userId: token.userId,
      owner: await this.loadOwner(token.userId),
      scopes: token.scopes,
      resourceScope: token.resourceScope,
      expiresAt: token.expiresAt,
      prefix: token.prefix,
    };
  }

  private async resolveOAuthToken(request: ScopedRequest): Promise<ScopeContext | null> {
    const session = await auth.api
      .getMcpSession({ headers: betterAuthHeaders(request.headers) })
      .catch((error) => {
        this.logger.debug(`OAuth token verification failed: ${describe(error)}`);
        return null;
      });

    // Not an OAuth access token. It may still be a Better Auth *session* token
    // presented as a bearer credential — that is how the mobile app and the
    // CLI's sign-in flow authenticate. Those carry no scopes, so hand them back
    // to the session path rather than rejecting them.
    if (!session?.userId) return this.rejectUnlessSession(request);

    const { scopes } = parseScopeString(session.scopes);

    return {
      kind: 'oauth',
      // The grant has no id of its own, so derive a stable one by digesting the
      // access token — never the token itself, which would put a live secret
      // into cache keys and logs.
      credentialId: `oauth:${hashApiTokenSecret(session.accessToken).slice(0, 32)}`,
      userId: session.userId,
      owner: await this.loadOwner(session.userId),
      scopes,
      // OAuth grants are not organization-restricted: the consent screen grants
      // permissions, and the user's own memberships bound their reach.
      resourceScope: toResourceScope(null),
      expiresAt: session.accessTokenExpiresAt ? new Date(session.accessTokenExpiresAt) : null,
    };
  }

  /**
   * A bearer credential that is neither an API token nor an OAuth grant is only
   * acceptable if Better Auth recognises it as a session token; anything else
   * is rejected rather than ignored, so a stale token can never fall through to
   * a cookie session's full rights.
   */
  private async rejectUnlessSession(request: ScopedRequest): Promise<null> {
    const session = await auth.api
      .getSession({ headers: betterAuthHeaders(request.headers) })
      .catch(() => null);

    if (!session) throw new AppError(ApiTokenErrors.INVALID_CREDENTIAL);
    return null;
  }

  /**
   * The credential's owner, as they exist right now. A missing or deactivated
   * owner invalidates every credential they issued — the same opaque error as
   * an unknown token, so the two are indistinguishable from outside.
   */
  private async loadOwner(userId: string): Promise<CredentialOwner> {
    const found = await this.users.findOneById(userId);
    if (found.isNone()) throw new AppError(ApiTokenErrors.INVALID_CREDENTIAL);

    const owner = found.unwrap();
    if (!owner.isActive) throw new AppError(ApiTokenErrors.INVALID_CREDENTIAL);

    return {
      id: owner.id,
      email: owner.email,
      firstName: owner.firstName,
      lastName: owner.lastName,
      role: owner.role,
      isActive: owner.isActive,
      emailVerified: owner.emailVerified,
    };
  }
}

/**
 * The request's source address. Behind a proxy this is the proxy's address
 * unless Express is configured with `trust proxy`, so an IP allowlist should
 * only be relied on once that is set (see the API tokens documentation).
 */
function sourceAddress(request: ScopedRequest): string | null {
  return request.ip ?? request.socket?.remoteAddress ?? null;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
