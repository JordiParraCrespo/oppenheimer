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
 * The application's `ThrottlerGuard`, keyed on **who is calling** rather than
 * on where the packets came from.
 *
 * The default tracker is the source IP, which is the right answer for a browser
 * hitting `/login` and the wrong one for callers that share an address: an
 * IP-keyed bucket would be shared by every caller behind one office NAT, and
 * the per-route limit would describe nothing anybody intended.
 *
 * **The bucket is derived from what the request presents, without verifying
 * it.** This guard is an `APP_GUARD`, so it runs before `ApiAuthGuard` has
 * resolved anything — and a limiter that resolved credentials itself would do
 * its database work *before* deciding whether to shed the request, which is
 * the one thing a limiter is for. So (see `CredentialScopePort.rateLimitKey`):
 *
 * - a bearer credential or `x-api-key` → `cred:<digest>`, one bucket per
 *   secret and never the secret itself (a host's single-use assertion is the
 *   exception, bucketed by the host it resolves to);
 * - a session cookie whose signature verifies → `session:<digest>`, one
 *   bucket per signed-in browser, not one per office;
 * - otherwise the user id, when this guard runs after authentication, then
 *   the IP.
 *
 * A digest bucket costs nothing to open, so a caller spraying made-up bearer
 * strings would get a fresh one per request. The brake is the auth-failure
 * budget (`AUTH_FAILURE_LIMITER`): every refused credential counts against its
 * source address, and an address past that budget is refused here before any
 * lookup — unless the credential it presents recently succeeded, so one broken
 * client does not lock out the callers that share its address.
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
