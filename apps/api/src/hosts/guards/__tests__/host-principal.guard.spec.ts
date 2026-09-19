import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CredentialScopePort } from '../../../auth/application/credential-scope.port';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { HostPrincipalGuard } from '../host-principal.guard';

/**
 * The whole authorization of `DELETE /hosts/self`. There is no person on such a
 * request, so if this guard admitted anyone else the route would be open.
 */
describe('HostPrincipalGuard', () => {
  let request: ScopedRequest;
  let credentials: Pick<CredentialScopePort, 'resolve'>;
  let guard: HostPrincipalGuard;

  const context = () =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

  beforeEach(() => {
    request = { headers: {} };
    credentials = { resolve: vi.fn().mockResolvedValue(null) };
    guard = new HostPrincipalGuard(credentials as CredentialScopePort);
  });

  it('admits a request the resolver classified as a host', async () => {
    vi.mocked(credentials.resolve).mockImplementation(async (target) => {
      (target as ScopedRequest).hostPrincipal = { hostId: 'host-1' };
      return null;
    });

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('resolves the credential itself rather than trusting what ran before it', async () => {
    // Global guards run before controller-level ones today; a guard whose
    // correctness depended on that order would break silently when it changes.
    await guard.canActivate(context()).catch(() => undefined);

    expect(credentials.resolve).toHaveBeenCalledWith(request);
  });

  it('refuses a browser session', async () => {
    request.user = { id: 'jordi' };

    await expect(guard.canActivate(context())).rejects.toMatchObject({ code: 'HOSTS_005' });
  });

  it('refuses a perfectly valid API token', async () => {
    // A route that exists for a machine to call about itself is not a route a
    // person's credential should reach, however well scoped it is.
    vi.mocked(credentials.resolve).mockResolvedValue({
      kind: 'api-token',
      credentialId: 'token-1',
      userId: 'jordi',
      owner: {
        id: 'jordi',
        email: 'jordi@example.com',
        firstName: 'Jordi',
        lastName: 'P',
        role: 'user',
        isActive: true,
        emailVerified: true,
      },
      scopes: ['hosts:write'],
      resourceScope: { organizationIds: null },
      expiresAt: null,
    });

    await expect(guard.canActivate(context())).rejects.toMatchObject({ code: 'HOSTS_005' });
  });

  it('lets the resolver’s own rejection through', async () => {
    // An unrecognisable bearer is refused where every other credential is
    // refused, with the same opaque answer.
    vi.mocked(credentials.resolve).mockRejectedValue(new Error('invalid credential'));

    await expect(guard.canActivate(context())).rejects.toThrow('invalid credential');
  });
});
