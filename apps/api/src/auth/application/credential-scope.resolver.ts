import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { parseScopeString, toResourceScope } from '@oppenheimer/shared';
import { CREDENTIAL_OWNER, CREDENTIAL_VERIFIER } from '../auth.di-tokens';
import { AuthErrors } from '../domain/auth.errors';
import type { CredentialOwner, ScopeContext, ScopedRequest } from '../domain/scope-context.types';
import type { CredentialVerifierPort } from '../infrastructure/credential-verifier.port';
import type { CredentialOwnerPort } from './credential-owner.port';
import { CredentialResolverRegistry } from './credential-resolver.registry';

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
 */
@Injectable()
export class CredentialScopeResolver {
  constructor(
    private readonly registry: CredentialResolverRegistry,
    @Inject(CREDENTIAL_VERIFIER)
    private readonly credentials: CredentialVerifierPort,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
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

    // First contribution that claims the string owns the outcome: a resolver
    // that recognises and then refuses throws, and that refusal is the answer.
    const resolver = this.registry.all().find((candidate) => candidate.recognises(presented));
    if (resolver) return resolver.resolve(presented, request);

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

  private async resolveOAuthToken(request: ScopedRequest): Promise<ScopeContext | null> {
    const session = await this.credentials.verifyOAuthGrant(request.headers);

    // Not an OAuth access token. It may still be a session token presented as
    // a bearer credential — that is how the mobile app and the CLI's sign-in
    // flow authenticate. Those carry no scopes, so hand them back to the
    // session path rather than rejecting them.
    if (!session) return this.rejectUnlessSession(request);

    const { scopes } = parseScopeString(session.scopes);

    return {
      kind: 'oauth',
      // The grant has no id of its own, so derive a stable one by digesting the
      // access token — never the token itself, which would put a live secret
      // into cache keys and logs.
      credentialId: `oauth:${digest(session.accessToken).slice(0, 32)}`,
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
   * A bearer credential no contribution recognised and that is not an OAuth
   * grant is only acceptable if the provider recognises it as a session token;
   * anything else is rejected rather than ignored, so a stale token can never
   * fall through to a cookie session's full rights.
   */
  private async rejectUnlessSession(request: ScopedRequest): Promise<null> {
    const recognised = await this.credentials.hasValidSession(request.headers);
    if (!recognised) throw new AppError(AuthErrors.INVALID_CREDENTIAL);
    return null;
  }

  /**
   * The credential's owner, as they exist right now. A missing or deactivated
   * owner invalidates every credential they issued — the same opaque error as
   * an unknown token, so the two are indistinguishable from outside.
   */
  private async loadOwner(userId: string): Promise<CredentialOwner> {
    const owner = await this.owners.findActiveOwner(userId);
    if (!owner) throw new AppError(AuthErrors.INVALID_CREDENTIAL);
    return owner;
  }
}

/**
 * SHA-256 of an access token, hex, used only to derive a stable credential id.
 * The digest is what goes into cache keys and logs; the token itself never
 * leaves this function.
 */
function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
