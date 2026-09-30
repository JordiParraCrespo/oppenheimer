import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { AppError } from '@oppenheimer/backend-core';
import type { AuthFailureLimiterPort } from '../../auth/application/auth-failure-limiter.port';
import type { CredentialScopePort } from '../../auth/application/credential-scope.port';
import { AUTH_FAILURE_LIMITER, CREDENTIAL_SCOPE } from '../../auth/auth.di-tokens';
import type { ScopedRequest } from '../../auth/domain/scope-context.types';
import { ThrottlingErrors } from '../domain/throttling.errors';

type HandleRequestProps = Parameters<ThrottlerGuard['handleRequest']>[0];

/**
 * The application's `ThrottlerGuard`, keyed on who is calling rather than the source
 * IP: an IP bucket is right for a browser hitting `/login` and wrong for callers
 * behind one office NAT.
 *
 * The bucket is derived from what the request presents, without verifying it: this is
 * an `APP_GUARD` and runs before `ApiAuthGuard`, and a limiter that resolved
 * credentials itself would do database work before deciding whether to shed the
 * request (see `CredentialScopePort.rateLimitKey`):
 *
 * - a bearer credential or `x-api-key` → `cred:<digest>`, one bucket per secret and
 *   never the secret itself (a host's single-use assertion is bucketed by its host);
 * - a session cookie whose signature verifies → `session:<digest>`;
 * - otherwise the user id, when this guard runs after authentication, then the IP.
 *
 * A digest bucket costs nothing to open, so made-up bearer strings would get a fresh
 * one per request. The brake is the auth-failure budget (`AUTH_FAILURE_LIMITER`):
 * refused credentials count against their source address, and an address past it is
 * refused here before any lookup, unless its credential recently succeeded, so one
 * broken client does not lock out the callers that share its address.
 */
@Injectable()
export class CredentialThrottlerGuard extends ThrottlerGuard {
  /**
   * Set by Nest through property injection rather than the constructor:
   * `ThrottlerGuard`'s own constructor signature is part of its public API and
   * this subclass must not change it.
   */
  @Inject(CREDENTIAL_SCOPE)
  private credentials!: CredentialScopePort;

  @Inject(AUTH_FAILURE_LIMITER)
  private failures!: AuthFailureLimiterPort;

  protected async handleRequest(requestProps: HandleRequestProps): Promise<boolean> {
    const request = requestProps.context.switchToHttp().getRequest<ScopedRequest>();
    const credentialKey = await this.credentialKeyOf(request);

    if (credentialKey?.startsWith('cred:') && this.failures) {
      const retryAfter = await this.failures.retryAfter(request.ip ?? 'unknown', credentialKey);
      if (retryAfter > 0) {
        throw new AppError(ThrottlingErrors.TOO_MANY_REQUESTS, {
          detail: `Too many refused credentials from this address; retry in ${retryAfter}s`,
          extensions: { retryAfter },
        });
      }
    }

    return super.handleRequest(requestProps);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as ScopedRequest;

    const credentialKey = await this.credentialKeyOf(request);
    if (credentialKey) return credentialKey;

    // Populated only when this guard is applied at route level, after
    // authentication. On the global path it is still undefined here.
    const userId = request.user?.id;
    if (typeof userId === 'string' && userId) return `user:${userId}`;

    return `ip:${request.ip ?? 'unknown'}`;
  }

  /**
   * Answer a blocked request with the catalog error instead of Nest's codeless
   * `ThrottlerException`. The base guard has already set `Retry-After` by the
   * time it calls this; the same number goes in `retryAfter` for clients that
   * read the body rather than the headers.
   */
  protected async throwThrottlingException(
    _context: ExecutionContext,
    limit: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new AppError(ThrottlingErrors.TOO_MANY_REQUESTS, {
      detail: `Rate limit reached; retry in ${limit.timeToBlockExpire}s`,
      extensions: { retryAfter: limit.timeToBlockExpire },
    });
  }

  /**
   * The request's credential bucket, or `null` for an anonymous caller.
   *
   * Deriving it never fails the request: a credential that is refused — here,
   * for a single-use kind that has to be resolved — is `ApiAuthGuard`'s to
   * reject a moment later, with the catalog error and the opaque wording that
   * keeps token ids from being probed.
   */
  private async credentialKeyOf(request: ScopedRequest): Promise<string | null> {
    if (!this.credentials) return null;
    return this.credentials.rateLimitKey(request).catch(() => null);
  }
}
