import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ScopedRequest } from '../auth/scope-context';
import { CredentialScopeResolver } from '../auth/services/credential-scope.resolver';

/**
 * The application's `ThrottlerGuard`, keyed on **who is calling** rather than
 * on where the packets came from.
 *
 * The default tracker is the source IP, which is the right answer for a browser
 * hitting `/login` and the wrong one for every machine caller we have. The
 * fleet's lead-collector Worker relays the contact-form enquiries of ~33
 * websites, and they all reach us from that one Worker: an IP-keyed bucket
 * would be shared by the entire fleet, so a busy day on one site would throttle
 * the other thirty-two, and the per-route limit would describe nothing anybody
 * intended.
 *
 * **This guard resolves the credential itself, and must.** It is registered as
 * an `APP_GUARD`, and Nest runs global guards *before* controller-level ones —
 * so `ApiAuthGuard`, which is what normally populates `request.scopeContext`,
 * has not run yet. Reading that property here would find it undefined on every
 * request, silently fall through to the IP branch, and leave the fleet sharing
 * one bucket while looking like it did not. Resolution is memoized on the
 * request (`CredentialScopeResolver.resolve`), so asking here costs nothing:
 * `ApiAuthGuard` awaits the same promise moments later.
 */
@Injectable()
export class CredentialThrottlerGuard extends ThrottlerGuard {
  /**
   * Set by Nest through property injection rather than the constructor:
   * `ThrottlerGuard`'s own constructor signature is part of its public API and
   * this subclass must not change it.
   */
  @Inject(CredentialScopeResolver)
  private credentials!: CredentialScopeResolver;

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as ScopedRequest;

    const credentialId = await this.credentialIdOf(request);
    if (credentialId) return `cred:${credentialId}`;

    // Populated only when this guard is applied at route level, after
    // authentication. On the global path it is still undefined here.
    const userId = request.user?.id;
    if (typeof userId === 'string' && userId) return `user:${userId}`;

    return `ip:${request.ip ?? 'unknown'}`;
  }

  /**
   * The calling credential's id, or `null` for a session or anonymous caller.
   *
   * A credential that fails to resolve — revoked, expired, unknown — is treated
   * as anonymous rather than allowed to throw. The rejection is `ApiAuthGuard`'s
   * to make a moment later, with the catalog error and the opaque wording that
   * keeps token ids from being probed; raising it from inside a rate limiter
   * would change the failure a client sees depending on which guard happened to
   * run first.
   */
  private async credentialIdOf(request: ScopedRequest): Promise<string | null> {
    if (!this.credentials) return null;
    try {
      const scope = await this.credentials.resolve(request);
      return scope?.credentialId ?? null;
    } catch {
      return null;
    }
  }
}
