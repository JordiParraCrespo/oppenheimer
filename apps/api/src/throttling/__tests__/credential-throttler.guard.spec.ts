import { describe, expect, it } from 'vitest';
import type { CredentialScopeResolver } from '../../auth/services/credential-scope.resolver';
import { CredentialThrottlerGuard } from '../credential-throttler.guard';

/**
 * The tracker decides which requests share a rate-limit bucket, and getting it
 * wrong is invisible: the limiter still works, it just limits the wrong set of
 * callers. That is exactly what happened before this suite existed — the guard
 * read `request.scopeContext`, which `ApiAuthGuard` populates, without
 * accounting for Nest running global guards *first*. On every real request that
 * property was undefined, the credential branch never fired, and the whole
 * website fleet quietly shared one IP bucket while the code looked correct.
 */
function guardWith(resolve: () => Promise<{ credentialId: string } | null>) {
  const guard = new CredentialThrottlerGuard({ throttlers: [] } as never, {} as never, {} as never);
  // Property-injected in production; set directly here.
  (guard as unknown as { credentials: Pick<CredentialScopeResolver, 'resolve'> }).credentials = {
    resolve,
  } as never;
  return guard as unknown as { getTracker(req: Record<string, unknown>): Promise<string> };
}

const anonymous = () => guardWith(async () => null);

describe('CredentialThrottlerGuard', () => {
  it('keys on the credential, which it resolves itself rather than reading off the request', async () => {
    // No `scopeContext` on the request on purpose: this guard runs before the
    // guard that would set one, so relying on it is the bug.
    const guard = guardWith(async () => ({ credentialId: 'token-7' }));

    expect(await guard.getTracker({ ip: '1.2.3.4' })).toBe('cred:token-7');
  });

  it('gives one credential one bucket regardless of what the body claims', async () => {
    // The site is attacker-controlled body content. Including it in the key
    // would let a caller mint an unlimited number of buckets by rotating
    // hostnames and walk straight past the documented limit; the per-site cap
    // belongs at the collector, where the hostname is the origin the form
    // actually posted to.
    const guard = guardWith(async () => ({ credentialId: 'token-7' }));

    const first = await guard.getTracker({ ip: '1.2.3.4', body: { siteDomain: 'a.com' } });
    const second = await guard.getTracker({ ip: '1.2.3.4', body: { siteDomain: 'b.com' } });

    expect(first).toBe(second);
  });

  it('does not let the whole fleet share one bucket just because it shares an egress IP', async () => {
    const one = guardWith(async () => ({ credentialId: 'token-a' }));
    const two = guardWith(async () => ({ credentialId: 'token-b' }));

    expect(await one.getTracker({ ip: '9.9.9.9' })).not.toBe(
      await two.getTracker({ ip: '9.9.9.9' }),
    );
  });

  it('falls back to the IP for an anonymous caller', async () => {
    expect(await anonymous().getTracker({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  it('prefers a resolved user when one is present, over the IP', async () => {
    // Only populated when the guard is applied at route level, after auth.
    expect(await anonymous().getTracker({ ip: '1.2.3.4', user: { id: 'user-3' } })).toBe(
      'user:user-3',
    );
  });

  it('treats an unresolvable credential as anonymous instead of throwing', async () => {
    // Rejecting a revoked token is `ApiAuthGuard`'s job, with the catalog error
    // and the opaque wording that keeps ids from being probed. Throwing from
    // inside a rate limiter would change the failure a client sees depending on
    // which guard happened to run first.
    const guard = guardWith(async () => {
      throw new Error('token revoked');
    });

    expect(await guard.getTracker({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  it('keeps the namespaces apart so an id can never collide with an address', async () => {
    const guard = guardWith(async () => ({ credentialId: '1.2.3.4' }));

    expect(await guard.getTracker({ ip: '1.2.3.4' })).not.toBe(
      await anonymous().getTracker({ ip: '1.2.3.4' }),
    );
  });
});
