import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CredentialOwnerPort } from '../../auth/application/credential-owner.port';
import type { CredentialResolverPort } from '../../auth/application/credential-resolver.port';
import { CREDENTIAL_OWNER } from '../../auth/auth.di-tokens';
import { AuthErrors } from '../../auth/domain/auth.errors';
import type {
  CredentialOwner,
  ScopeContext,
  ScopedRequest,
} from '../../auth/domain/scope-context.types';
import { API_TOKEN_REPOSITORY } from '../api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../database/api-token.repository.port';
import { ApiTokenErrors } from '../domain/api-token.errors';
import { hashApiTokenSecret, isApiTokenSecret } from '../domain/api-token-secret.factory';

/**
 * This module's contribution to the auth kernel: `oppenheimer_pat_…` secrets,
 * presented as a bearer credential or in `x-api-key`.
 *
 * The kernel recognises no token format of its own — it asks every registered
 * resolver whether a presented string is theirs, and this one claims the
 * prefix its secrets are minted with. Everything a token can fail on (unknown
 * digest, revoked, expired, an address outside its allowlist) is decided here,
 * against this module's repository, because this module is what those rules
 * belong to.
 */
@Injectable()
export class ApiTokenCredentialResolver implements CredentialResolverPort {
  readonly kind = 'api-token';

  private readonly logger = new Logger(ApiTokenCredentialResolver.name);

  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokens: ApiTokenRepositoryPort,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
  ) {}

  /** Our secrets carry a namespace prefix, so the shape check is exact. */
  recognises(presented: string): boolean {
    return isApiTokenSecret(presented);
  }

  async resolve(secret: string, request: ScopedRequest): Promise<ScopeContext> {
    const found = await this.apiTokens.findOneByHash(hashApiTokenSecret(secret));
    if (found.isNone()) throw new AppError(AuthErrors.INVALID_CREDENTIAL);

    const token = found.unwrap();
    const rejection = token.rejectionReason({
      now: new Date(),
      ipAddress: sourceAddress(request),
    });

    if (rejection === 'ip-not-allowed') throw new AppError(ApiTokenErrors.IP_NOT_ALLOWED);
    // Revoked and expired share the credential error: distinguishing them
    // would tell an attacker which of their guesses used to be real.
    if (rejection) throw new AppError(AuthErrors.INVALID_CREDENTIAL);

    // Best-effort usage stamp — never let it fail the request.
    void this.apiTokens
      .touchLastUsedAt(token.id, new Date())
      .catch((error) => this.logger.warn(`Could not record token usage: ${describe(error)}`));

    return {
      kind: this.kind,
      credentialId: token.id,
      userId: token.userId,
      owner: await this.loadOwner(token.userId),
      scopes: token.scopes,
      resourceScope: token.resourceScope,
      expiresAt: token.expiresAt,
      prefix: token.prefix,
    };
  }

  /**
   * The token's owner, as they exist right now. A missing or deactivated owner
   * invalidates every credential they issued — the same opaque error as an
   * unknown token, so the two are indistinguishable from outside.
   */
  private async loadOwner(userId: string): Promise<CredentialOwner> {
    const owner = await this.owners.findActiveOwner(userId);
    if (!owner) throw new AppError(AuthErrors.INVALID_CREDENTIAL);
    return owner;
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
